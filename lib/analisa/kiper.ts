// Analisa → Kiper: HANYA kiper. ESPN: ringkasan tiap laga selesai (siapa yang jadi kiper, menit, penyelamatan, kebobolan).
// xG lawan per laga dari FotMob (opsional, lewat pola-server). Murni logika + pemuat ESPN yang bisa disuntik untuk uji.
import { JUVE_ID, isCompleted } from '../espn';
import { loadJuve } from '../juve';
import { buildLiveMatch, fetchSummary } from '../live';
import { findPlayer } from '../names';
import { fetchFotmob } from '../squad';
import type { LineupPlayer } from '../types';
import { xgByMatch } from './pola-server';
import { minuteOf, r1 } from './util';

export interface KeeperRow {
  id: string;
  name: string;
  /** main = tampil di lapangan (termasuk masuk dari bangku) */
  played: number;
  started: number;
  minutes: number;
  saves: number;
  conceded: number;
  /** main minimal 85 menit tanpa kebobolan */
  cleanSheets: number;
  /** penyelamatan / (penyelamatan + kebobolan), 0..1; null bila belum ada tembakan tepat sasaran */
  savePct: number | null;
  /** xG lawan di laga yang dimulai kiper ini; null bila tidak ada laga start dengan data xG */
  xgFaced: number | null;
  /** gol yang ia kebobolan di laga-laga yang sama dengan xgFaced */
  concededXg: number | null;
  /** xgFaced − concededXg; positif = menyelamatkan lebih banyak dari perkiraan */
  prevented: number | null;
}

export interface KiperResponse {
  keepers: KeeperRow[];
  /** id kiper dengan menit bermain terbanyak */
  mainId: string | null;
  /** jumlah laga Juventus selesai yang dianalisis */
  matches: number;
  /** jumlah laga dengan data xG */
  xgMatches: number;
  warnings: string[];
  updatedAt: string;
}

const CLEAN_SHEET_MINUTES = 85;

const statOf = (entry: any, name: string): number | null => {
  const s = (entry?.stats ?? []).find((x: any) => x?.name === name);
  if (!s) return null;
  const v = Number(s.value);
  return Number.isFinite(v) ? v : null;
};

const isGkLabel = (a: string) => /^(G|GK)$/i.test(a) || /goalkeeper|portiere|keeper/i.test(a);

/** Peran pemain menurut skuad resmi: dipakai untuk memastikan hanya kiper yang dihitung. */
export type SquadRole = 'gk' | 'other' | null;

/**
 * Apakah pemain ini kiper? Urutan bukti (yang pertama cocok menang):
 *  1. label posisi G/GK dari ESPN → kiper;  2. skuad menyebut ia bukan kiper → bukan;
 *  3. label posisi lapangan lain (CD, CM, F, …) → bukan;  4. skuad menyebut ia kiper → kiper;
 *  5. hanya berlabel SUB/kosong → kiper bila punya statistik khas kiper (penyelamatan atau tembakan yang dihadapi).
 * "Kebobolan" saja TIDAK cukup sebagai bukti: ESPN bisa mengisinya untuk pemain lapangan.
 */
export function isKeeper(labels: string[], role: SquadRole, saves: number | null, shotsFaced: number | null): boolean {
  const ls = labels.map((x) => String(x ?? '').trim()).filter(Boolean);
  if (ls.some(isGkLabel)) return true;
  if (role === 'other') return false;
  if (ls.some((a) => !/^SUB$/i.test(a))) return false;
  if (role === 'gk') return true;
  return (saves ?? 0) > 0 || (shotsFaced ?? 0) > 0;
}

interface Acc {
  name: string;
  played: number;
  started: number;
  minutes: number;
  saves: number;
  conceded: number;
  cleanSheets: number;
  xgFaced: number;
  concededXg: number;
  xgStarts: number;
}

/** Hitung statistik kiper dari ringkasan ESPN. `xg` = xG lawan per laga (kunci: id event ESPN), boleh kosong. */
export async function buildKiper(
  events: any[],
  xg: Map<string, { f: number; a: number }> = new Map(),
  load: (league: string, id: string, live: boolean) => Promise<any | null> = fetchSummary,
  roleOf: (name: string) => SquadRole = () => null
): Promise<KiperResponse> {
  const done = events.filter(isCompleted);
  const summaries: { event: any; summary: any }[] = [];
  for (let i = 0; i < done.length; i += 8) {
    const batch = done.slice(i, i + 8);
    const res = await Promise.all(batch.map((e) => load(e._league, String(e.id), false)));
    batch.forEach((event, k) => res[k] && summaries.push({ event, summary: res[k] }));
  }

  const people = new Map<string, Acc>();
  const warnings: string[] = [];
  let matches = 0;
  let xgMatches = 0;
  let noSaveStat = 0;
  let noKeeper = 0;

  for (const { event, summary } of summaries) {
    const live = buildLiveMatch(event, summary);
    const lineup = [live.lineups.home, live.lineups.away].find((l) => l?.teamId === JUVE_ID);
    if (!lineup) continue;
    matches += 1;

    const juveIsHome = live.home.isJuve;
    const oppSide = juveIsHome ? live.away : live.home;
    const oppTl = juveIsHome ? 'away' : 'home';

    // Laga yang lanjut ke perpanjangan waktu: ada menit di atas 95 (selain tambahan waktu "90+x")
    const maxMinute = Math.max(0, ...live.timeline.filter((t) => t.kind !== 'period').map((t) => minuteOf(t.minute) ?? 0));
    const length = maxMinute > 95 || live.shootout ? 120 : 90;

    const rawRoster: any[] = (summary.rosters ?? []).find((r: any) => String(r?.team?.id) === JUVE_ID)?.roster ?? [];
    const raw = new Map(rawRoster.map((p) => [String(p?.athlete?.id ?? p?.id ?? ''), p]));

    // 1) siapa saja kiper yang turun di laga ini
    const gks: { p: LineupPlayer; started: boolean; on: number; off: number; entry: any }[] = [];
    const consider = (p: LineupPlayer, started: boolean) => {
      const entry = raw.get(p.id);
      const labels = [p.position, entry?.position?.abbreviation, entry?.athlete?.position?.abbreviation];
      if (!isKeeper(labels, roleOf(p.name), statOf(entry, 'saves'), statOf(entry, 'shotsFaced'))) return;
      const on = started ? 0 : minuteOf(p.subOn);
      if (on == null) return; // kiper cadangan yang tidak turun
      gks.push({ p, started, on, off: minuteOf(p.subOff) ?? length, entry });
    };
    lineup.starters.forEach((p) => consider(p, true));
    lineup.subs.forEach((p) => consider(p, false));
    if (!gks.length) {
      noKeeper += 1;
      continue;
    }

    const x = xg.get(String(event.id));
    if (x) xgMatches += 1;

    // 2) angka tiap kiper
    for (const g of gks) {
      let saves = statOf(g.entry, 'saves');
      if (saves == null) {
        saves = 0;
        noSaveStat += 1;
      }
      let conceded = statOf(g.entry, 'goalsConceded');
      if (conceded == null) {
        // ESPN tidak melaporkan: satu kiper = semua gol lawan; dua kiper = gol lawan dalam rentang menitnya.
        conceded =
          gks.length === 1
            ? oppSide.score
            : live.timeline.filter((t) => t.side === oppTl && (t.kind === 'goal' || t.kind === 'pen-goal') && (minuteOf(t.minute) ?? -1) >= g.on && (minuteOf(t.minute) ?? 999) <= g.off).length;
      }
      const minutes = Math.max(0, g.off - g.on);

      const acc = people.get(g.p.id) ?? { name: g.p.name, played: 0, started: 0, minutes: 0, saves: 0, conceded: 0, cleanSheets: 0, xgFaced: 0, concededXg: 0, xgStarts: 0 };
      people.set(g.p.id, acc);
      acc.played += 1;
      acc.started += g.started ? 1 : 0;
      acc.minutes += minutes;
      acc.saves += saves;
      acc.conceded += conceded;
      if (minutes >= CLEAN_SHEET_MINUTES && conceded === 0) acc.cleanSheets += 1;
      if (g.started && x) {
        acc.xgFaced += x.a;
        acc.concededXg += conceded;
        acc.xgStarts += 1;
      }
    }
  }

  const keepers: KeeperRow[] = [...people.entries()]
    .map(([id, a]) => ({
      id,
      name: a.name,
      played: a.played,
      started: a.started,
      minutes: a.minutes,
      saves: a.saves,
      conceded: a.conceded,
      cleanSheets: a.cleanSheets,
      savePct: a.saves + a.conceded > 0 ? a.saves / (a.saves + a.conceded) : null,
      xgFaced: a.xgStarts ? r1(a.xgFaced) : null,
      concededXg: a.xgStarts ? a.concededXg : null,
      prevented: a.xgStarts ? r1(a.xgFaced - a.concededXg) : null,
    }))
    .sort((a, b) => b.minutes - a.minutes || b.started - a.started || a.name.localeCompare(b.name));

  if (!matches) warnings.push('Belum ada laga Juventus yang selesai di data ESPN.');
  else if (!keepers.length) warnings.push('Susunan pemain ESPN tidak memuat kiper untuk laga-laga ini.');
  if (noKeeper) warnings.push(`Kiper tidak teridentifikasi di ${noKeeper} dari ${matches} laga (susunan pemain ESPN kosong); laga itu tidak dihitung.`);
  if (noSaveStat) warnings.push('ESPN tidak melaporkan jumlah penyelamatan untuk sebagian penampilan kiper; dihitung 0.');
  if (matches && !xgMatches) warnings.push('xG lawan tidak tersedia dari FotMob (endpoint tidak resmi, mungkin diblokir); kolom xG ditampilkan "–".');
  else if (matches && xgMatches < matches) warnings.push(`xG lawan hanya tersedia untuk ${xgMatches} dari ${matches} laga; "gol dicegah" dihitung dari laga itu saja.`);

  return { keepers, mainId: keepers[0]?.id ?? null, matches, xgMatches, warnings, updatedAt: new Date().toISOString() };
}

/** Peran tiap pemain dari skuad FotMob (kolom "Kiper"); skuad gagal dimuat → tidak ada peran, aturan label+statistik yang dipakai. */
async function squadRoles(): Promise<(name: string) => SquadRole> {
  try {
    const { players } = await fetchFotmob();
    const gks = players.filter((p) => p.group === 'Kiper');
    const others = players.filter((p) => p.group !== 'Kiper');
    return (name) => (findPlayer(name, gks) ? 'gk' : findPlayer(name, others) ? 'other' : null);
  } catch {
    return () => null;
  }
}

export async function fetchKiper(): Promise<KiperResponse> {
  const { juveEvents } = await loadJuve();
  const games = juveEvents.filter(isCompleted).map((e: any) => ({ id: String(e.id), iso: new Date(e.date).toISOString() }));
  const [{ xg }, roleOf] = await Promise.all([xgByMatch(games).catch(() => ({ xg: new Map<string, { f: number; a: number }>(), tried: 0 })), squadRoles()]);
  return buildKiper(juveEvents, xg, fetchSummary, roleOf);
}
