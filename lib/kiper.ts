// Analisa → Kiper. ESPN: ringkasan tiap laga selesai (siapa yang jadi kiper, menit, penyelamatan, kebobolan).
// xG lawan per laga dari FotMob (opsional, lewat lib/pola-server). Murni logika + satu pemuat ESPN yang bisa disuntik untuk uji.
import { JUVE_ID, isCompleted } from './espn';
import { buildLiveMatch, fetchSummary } from './live';
import type { LineupPlayer } from './types';

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
const r1 = (n: number) => Math.round(n * 10) / 10;

const statOf = (entry: any, name: string): number | null => {
  const s = (entry?.stats ?? []).find((x: any) => x?.name === name);
  if (!s) return null;
  const v = Number(s.value);
  return Number.isFinite(v) ? v : null;
};

/** "67'" → 67, "90+3'" → 90, kosong → null */
function minuteOf(raw: string): number | null {
  const m = /^(\d+)/.exec(String(raw ?? '').trim());
  return m ? Number(m[1]) : null;
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
  load: (league: string, id: string, live: boolean) => Promise<any | null> = fetchSummary
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
      const pos = [p.position, entry?.position?.abbreviation, entry?.athlete?.position?.abbreviation].map((x) => String(x ?? '').trim());
      const saves = statOf(entry, 'saves');
      const faced = statOf(entry, 'shotsFaced');
      const conc = statOf(entry, 'goalsConceded');
      // Pemain cadangan sering hanya berlabel "SUB": dianggap kiper bila ada statistik kiper yang terisi.
      const isGk = pos.some((a) => /^G/i.test(a)) || (!started && ((saves ?? 0) > 0 || (faced ?? 0) > 0 || (conc ?? 0) > 0));
      if (!isGk) return;
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
