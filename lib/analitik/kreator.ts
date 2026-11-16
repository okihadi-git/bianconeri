// Analitik → Peluang diciptakan: murni fungsi (tanpa fetch), jadi gampang diuji.
// Sumber: FotMob matchDetails (content.playerStats + content.shotmap). ESPN tidak punya xA maupun umpan kunci.

export interface PlayerMatchLine {
  id: string;
  name: string;
  /** umpan kunci (chances created) */
  chances: number | null;
  /** expected assists */
  xa: number | null;
  assists: number | null;
  /** big chances created */
  big: number | null;
}

export interface MatchChance {
  id: string;
  leagueId: string;
  leagueName: string;
  players: PlayerMatchLine[];
  /** situasi tembakan Juventus: RegularPlay, FromCorner, SetPiece, FastBreak, Penalty, ThrowInSetPiece, ... */
  situations: Record<string, number>;
}

export interface Creator {
  id: string;
  name: string;
  photo: string;
  chances: number;
  xa: number;
  assists: number;
  big: number;
  matches: number;
  /** gaji kotor per tahun (euro) dari database gaji; null bila tidak ada */
  salary: number | null;
}

export interface WayRow {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export interface KreatorResponse {
  /** 10 teratas */
  top: Creator[];
  /** urutan memakai xA, atau umpan kunci bila FotMob tidak melaporkan xA */
  rankedBy: 'xa' | 'chances';
  cards: {
    xa: { name: string; xa: number; chances: number } | null;
    chances: { name: string; chances: number } | null;
    big: { name: string; big: number } | null;
    total: { chances: number; matches: number };
  };
  ways: WayRow[];
  waysTotal: number;
  competitions: { id: string; name: string; matches: number }[];
  comp: string;
  warnings: string[];
  updatedAt: string;
}

const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** Cari satu angka di grup statistik FotMob. Cocokkan lewat `key` (stabil) atau label (cadangan). */
function pickStat(stats: any, keyRe: RegExp, labelRe: RegExp): number | null {
  for (const group of Array.isArray(stats) ? stats : []) {
    const entries = group?.stats && typeof group.stats === 'object' ? Object.entries<any>(group.stats) : [];
    for (const [label, entry] of entries) {
      if (keyRe.test(String(entry?.key ?? '')) || labelRe.test(label)) {
        const v = numOrNull(entry?.stat?.value ?? entry?.value);
        if (v != null) return v;
      }
    }
  }
  return null;
}

/** Ringkas satu pertandingan FotMob → angka pemain Juventus + situasi tembakan. Null bila playerStats tidak ada. */
export function parseMatchDetails(data: any, teamId: string): MatchChance | null {
  const ps = data?.content?.playerStats;
  if (!ps || typeof ps !== 'object') return null;

  const players: PlayerMatchLine[] = [];
  for (const [pid, p] of Object.entries<any>(ps)) {
    if (String(p?.teamId) !== teamId || p?.isGoalkeeper) continue;
    players.push({
      id: String(p?.id ?? pid),
      name: String(p?.name ?? '').trim(),
      chances: pickStat(p.stats, /^chances_created$/i, /^chances created$/i),
      xa: pickStat(p.stats, /^expected_assists$/i, /^expected assists/i),
      assists: pickStat(p.stats, /^assists$/i, /^assists$/i),
      big: pickStat(p.stats, /^big_chances?_created$/i, /^big chances? created$/i),
    });
  }
  if (!players.length) return null;

  const situations: Record<string, number> = {};
  const shots: any[] = Array.isArray(data?.content?.shotmap?.shots) ? data.content.shotmap.shots : [];
  for (const s of shots) {
    if (String(s?.teamId) !== teamId) continue;
    const k = String(s?.situation ?? 'Lainnya');
    situations[k] = (situations[k] ?? 0) + 1;
  }

  return {
    id: String(data?.general?.matchId ?? ''),
    leagueId: String(data?.general?.leagueId ?? data?.general?.parentLeagueId ?? ''),
    leagueName: String(data?.general?.leagueName ?? data?.general?.parentLeagueName ?? 'Lainnya'),
    players,
    situations,
  };
}

export const SITUATION_LABEL: Record<string, string> = {
  RegularPlay: 'Permainan terbuka',
  FromCorner: 'Sepak pojok',
  SetPiece: 'Bola mati',
  FastBreak: 'Serangan balik',
  ThrowInSetPiece: 'Lemparan ke dalam',
  Penalty: 'Penalti',
  FreeKick: 'Tendangan bebas',
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Gabungkan semua laga → peringkat pemain, kartu ringkasan, dan komposisi situasi. */
export function aggregate(
  matches: MatchChance[],
  opts: { photo: (id: string) => string; salaryOf?: (p: { id: string; name: string }) => number | null }
): Omit<KreatorResponse, 'competitions' | 'comp' | 'warnings' | 'updatedAt'> {
  const by = new Map<string, Creator>();
  let totalChances = 0;
  const sit: Record<string, number> = {};

  for (const m of matches) {
    for (const p of m.players) {
      const c = by.get(p.id) ?? { id: p.id, name: p.name, photo: opts.photo(p.id), chances: 0, xa: 0, assists: 0, big: 0, matches: 0, salary: null };
      by.set(p.id, c);
      c.chances += p.chances ?? 0;
      c.xa += p.xa ?? 0;
      c.assists += p.assists ?? 0;
      c.big += p.big ?? 0;
      if (p.chances != null || p.xa != null) c.matches += 1;
      totalChances += p.chances ?? 0;
    }
    for (const [k, v] of Object.entries(m.situations)) sit[k] = (sit[k] ?? 0) + v;
  }

  const all = [...by.values()].map((c) => ({ ...c, xa: r2(c.xa), salary: opts.salaryOf?.(c) ?? null })).filter((c) => c.chances > 0 || c.xa > 0);
  const hasXa = all.some((c) => c.xa > 0);
  const rankedBy = hasXa ? 'xa' : 'chances';
  const sorted = [...all].sort((a, b) => (rankedBy === 'xa' ? b.xa - a.xa || b.chances - a.chances : b.chances - a.chances || b.xa - a.xa) || a.name.localeCompare(b.name));

  const best = <K extends 'xa' | 'chances' | 'big'>(k: K) => {
    const top = [...all].sort((a, b) => b[k] - a[k] || b.chances - a.chances)[0];
    return top && top[k] > 0 ? top : null;
  };
  const bx = best('xa');
  const bc = best('chances');
  const bb = best('big');

  const waysTotal = Object.values(sit).reduce((a, b) => a + b, 0);
  const ways = Object.entries(sit)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: SITUATION_LABEL[key] ?? key, count, pct: waysTotal ? Math.round((count / waysTotal) * 100) : 0 }));

  return {
    top: sorted.slice(0, 10),
    rankedBy,
    cards: {
      xa: bx ? { name: bx.name, xa: bx.xa, chances: bx.chances } : null,
      chances: bc ? { name: bc.name, chances: bc.chances } : null,
      big: bb ? { name: bb.name, big: bb.big } : null,
      total: { chances: totalChances, matches: matches.length },
    },
    ways,
    waysTotal,
  };
}
