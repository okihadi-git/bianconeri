// Analitik → 12 Disiplin: murni fungsi (tanpa fetch), jadi gampang diuji.
// Sumber: FotMob matchDetails → content.stats (pelanggaran, kartu, offside tim) + content.playerStats (pelanggaran & dilanggar per pemain).
// Menit dan kartu per pemain datang dari lineup/kejadian laga (aggregateMatch milik Akademi), digabung di aggregate().

export interface DisiplinMatch {
  id: string;
  fouls: number | null;
  yellow: number | null;
  red: number | null;
  offsides: number | null;
  players: { id: string; name: string; fouls: number | null; fouled: number | null }[];
}

export interface PlayerBase {
  id: string;
  name: string;
  minutes: number;
  yellow: number;
  red: number;
}

export interface CommitRow {
  id: string;
  name: string;
  per90: number;
  fouls: number;
  minutes: number;
  yellow: number;
  red: number;
}

export interface FouledRow {
  id: string;
  name: string;
  per90: number;
  fouled: number;
  minutes: number;
}

export interface DisiplinBody {
  /** laga resmi yang dihitung */
  matches: number;
  fouls: { total: number; perGame: number | null; matches: number };
  /** kartu: dari statistik tim bila lengkap, kalau tidak dari kejadian laga per pemain */
  cards: { yellow: number; red: number; fromTeamStats: boolean };
  offsides: { total: number; perGame: number | null; matches: number };
  committed: CommitRow[];
  fouled: FouledRow[];
  mostFouled: FouledRow | null;
  minMinutes: number;
}

export interface DisiplinResponse extends DisiplinBody {
  warnings: string[];
  updatedAt: string;
}

export const MIN_MINUTES = 180;

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Cari statistik dua sisi [home, away] di content.stats FotMob lewat key atau judul. */
function pair(stats: any, keyRe: RegExp, titleRe: RegExp): [number, number] | null {
  let found: [number, number] | null = null;
  const walk = (n: any, depth = 0) => {
    if (found || !n || typeof n !== 'object' || depth > 7) return;
    if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1));
    if ((keyRe.test(String(n.key ?? '')) || titleRe.test(String(n.title ?? ''))) && Array.isArray(n.stats) && n.stats.length >= 2) {
      const a = num(n.stats[0]);
      const b = num(n.stats[1]);
      if (a != null && b != null) {
        found = [a, b];
        return;
      }
    }
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(stats);
  return found;
}

/** Satu angka dari kumpulan statistik pemain FotMob lewat key atau label. */
function playerStat(p: any, keyRe: RegExp, labelRe: RegExp): number | null {
  for (const group of Array.isArray(p?.stats) ? p.stats : []) {
    for (const [label, v] of Object.entries<any>(group?.stats ?? {})) {
      if (keyRe.test(String(v?.key ?? '')) || labelRe.test(label)) {
        const x = num(v?.stat?.value);
        if (x != null) return x;
      }
    }
  }
  return null;
}

/** Ringkas satu pertandingan FotMob. Null bila bukan laga Juventus atau belum selesai. */
export function parseMatchDisiplin(data: any, teamId: string): DisiplinMatch | null {
  const juveHome = String(data?.general?.homeTeam?.id) === teamId;
  if (!juveHome && String(data?.general?.awayTeam?.id) !== teamId) return null;
  const st = data?.header?.status;
  if (st && (st.finished === false || st.cancelled === true)) return null;

  const stats = data?.content?.stats;
  const mine = (p: [number, number] | null) => (p ? (juveHome ? p[0] : p[1]) : null);
  const players: DisiplinMatch['players'] = [];
  const ps = data?.content?.playerStats;
  if (ps && typeof ps === 'object') {
    for (const [pid, p] of Object.entries<any>(ps)) {
      if (String(p?.teamId) !== teamId) continue;
      const fouls = playerStat(p, /^fouls?$|fouls_?committed/i, /^fouls committed$/i);
      const fouled = playerStat(p, /was_?fouled|fouls_?won/i, /^was fouled$/i);
      if (fouls != null || fouled != null) players.push({ id: pid, name: String(p?.name ?? ''), fouls, fouled });
    }
  }
  return {
    id: String(data?.general?.matchId ?? ''),
    fouls: mine(pair(stats, /^fouls$/i, /^fouls committed$|^fouls$/i)),
    yellow: mine(pair(stats, /^yellow_?cards?$/i, /^yellow cards$/i)),
    red: mine(pair(stats, /^red_?cards?$/i, /^red cards$/i)),
    offsides: mine(pair(stats, /^offsides?$/i, /^offsides$/i)),
    players,
  };
}

const sumOf = (a: number[]) => a.reduce((n, v) => n + v, 0);

export function aggregate(matches: DisiplinMatch[], base: PlayerBase[], minMinutes = MIN_MINUTES): DisiplinBody {
  const withFouls = matches.filter((m) => m.fouls != null);
  const withOff = matches.filter((m) => m.offsides != null);
  const foulsTotal = sumOf(withFouls.map((m) => m.fouls as number));
  const offTotal = sumOf(withOff.map((m) => m.offsides as number));

  // Kartu: statistik tim dipakai hanya bila ada di SEMUA laga; kalau tidak, jumlah dari kejadian laga per pemain.
  const teamCards = matches.length > 0 && matches.every((m) => m.yellow != null && m.red != null);
  const yellow = teamCards ? sumOf(matches.map((m) => m.yellow as number)) : sumOf(base.map((p) => p.yellow));
  const red = teamCards ? sumOf(matches.map((m) => m.red as number)) : sumOf(base.map((p) => p.red));

  const acc = new Map<string, { name: string; fouls: number | null; fouled: number | null }>();
  for (const m of matches) {
    for (const p of m.players) {
      const a = acc.get(p.id) ?? { name: p.name, fouls: null, fouled: null };
      if (p.fouls != null) a.fouls = (a.fouls ?? 0) + p.fouls;
      if (p.fouled != null) a.fouled = (a.fouled ?? 0) + p.fouled;
      if (p.name) a.name = p.name;
      acc.set(p.id, a);
    }
  }
  const baseBy = new Map(base.map((p) => [p.id, p]));
  const committed: CommitRow[] = [];
  const fouled: FouledRow[] = [];
  for (const [id, a] of acc) {
    const b = baseBy.get(id);
    if (!b || b.minutes < minMinutes) continue;
    const name = b.name || a.name;
    if (a.fouls != null && a.fouls > 0) committed.push({ id, name, per90: r2((a.fouls / b.minutes) * 90), fouls: a.fouls, minutes: b.minutes, yellow: b.yellow, red: b.red });
    if (a.fouled != null && a.fouled > 0) fouled.push({ id, name, per90: r2((a.fouled / b.minutes) * 90), fouled: a.fouled, minutes: b.minutes });
  }
  committed.sort((x, y) => y.per90 - x.per90 || y.fouls - x.fouls);
  fouled.sort((x, y) => y.per90 - x.per90 || y.fouled - x.fouled);

  return {
    matches: matches.length,
    fouls: { total: foulsTotal, perGame: withFouls.length ? r2(foulsTotal / withFouls.length) : null, matches: withFouls.length },
    cards: { yellow, red, fromTeamStats: teamCards },
    offsides: { total: offTotal, perGame: withOff.length ? r2(offTotal / withOff.length) : null, matches: withOff.length },
    committed: committed.slice(0, 8),
    fouled: fouled.slice(0, 8),
    mostFouled: fouled[0] ?? null,
    minMinutes,
  };
}
