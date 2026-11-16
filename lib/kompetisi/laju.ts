// "Laju poin": poin kumulatif tiap klub setelah tiap laga. Fungsi murni, mudah diuji.

export interface PointsMatch {
  iso: string;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
}

/** Poin kumulatif per klub setelah laga ke-1, ke-2, dst. (urut menurut tanggal main). Indeks 0 = setelah laga pertama. */
export function buildSeries(matches: PointsMatch[]): Map<string, number[]> {
  const sorted = [...matches].sort((a, b) => a.iso.localeCompare(b.iso));
  const out = new Map<string, number[]>();
  const add = (id: string, pts: number) => {
    const s = out.get(id) ?? [];
    s.push((s.length ? s[s.length - 1] : 0) + pts);
    out.set(id, s);
  };
  for (const m of sorted) {
    const hp = m.homeScore > m.awayScore ? 3 : m.homeScore === m.awayScore ? 1 : 0;
    const ap = m.homeScore < m.awayScore ? 3 : m.homeScore === m.awayScore ? 1 : 0;
    add(m.homeId, hp);
    add(m.awayId, ap);
  }
  return out;
}

/** Poin setelah `n` laga; null bila klub itu belum/tidak punya data sejauh itu. */
export function pointsAt(series: number[] | undefined, n: number): number | null {
  if (!series || n < 1) return n === 0 ? 0 : null;
  return n <= series.length ? series[n - 1] : null;
}

export interface LajuTeam {
  id: string;
  name: string;
  abbr: string;
  logo: string;
  position: number;
  points: number;
  played: number;
  series: number[];
}

export interface Benchmark {
  /** mis. "Napoli" */
  team: string;
  /** mis. "2025/26" */
  season: string;
  total: number;
  series: number[];
}

export interface LajuSummary {
  n: number;
  points: number;
  ppg: number;
  projected: number;
  vsChampion: { diff: number; at: number } | null;
  vsRecord: { diff: number; at: number } | null;
}

export function summarize(juve: LajuTeam, totalGames: number, champion: Benchmark | null, record: Benchmark | null): LajuSummary {
  const n = juve.series.length;
  const points = n ? juve.series[n - 1] : 0;
  const ppg = n ? points / n : 0;
  const cmp = (b: Benchmark | null) => {
    const at = b ? pointsAt(b.series, n) : null;
    return at === null ? null : { diff: points - at, at };
  };
  return { n, points, ppg, projected: Math.round(ppg * totalGames), vsChampion: cmp(champion), vsRecord: cmp(record) };
}
