// Analitik → 10 Musim ini vs musim lalu: murni fungsi (tanpa fetch), jadi gampang diuji.
// Sumber: ESPN scoreboard Serie A (kedua musim dari sumber yang sama supaya sebanding).
// "Pekan yang sama" = jumlah laga Serie A yang sudah selesai musim ini; musim lalu dipotong pada jumlah laga itu (urut tanggal).

export interface SeasonGame {
  iso: string;
  gf: number;
  ga: number;
}

export interface SeasonTotals {
  points: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  cleanSheets: number;
  gd: number;
}

export interface MusimBody {
  /** jumlah laga Serie A yang dibandingkan */
  n: number;
  now: SeasonTotals | null;
  prev: SeasonTotals | null;
  /** poin kumulatif setelah tiap laga (panjang n) */
  curveNow: number[];
  curvePrev: number[];
  nowLabel: string;
  prevLabel: string;
  /** laga Serie A musim lalu yang tersedia dan poin akhir musim lalu */
  prevSeason: { games: number; points: number } | null;
}

export interface MusimResponse extends MusimBody {
  warnings: string[];
  updatedAt: string;
}

export const SEASON_GAMES = 38;

/** Skor ESPN bisa berupa angka, string, atau objek {value, displayValue}. */
const toNum = (v: any): number | null => {
  const raw = v && typeof v === 'object' ? v.value ?? v.displayValue : v;
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
};

/** Satu event ESPN → laga selesai Juventus (null bila bukan laga Juventus, belum selesai, atau skor tidak ada). */
export function parseGame(event: any, juveId: string): SeasonGame | null {
  const comp = event?.competitions?.[0];
  const status = comp?.status ?? event?.status; // sama dengan isCompleted() di lib/espn.ts
  if (!(Boolean(status?.type?.completed) || status?.type?.state === 'post')) return null;
  const list: any[] = comp?.competitors ?? [];
  const juve = list.find((c) => String(c?.team?.id) === juveId);
  const opp = list.find((c) => String(c?.team?.id) !== juveId);
  const gf = toNum(juve?.score);
  const ga = toNum(opp?.score);
  if (!juve || !opp || gf == null || ga == null || Number.isNaN(new Date(event?.date).getTime())) return null;
  return { iso: new Date(event.date).toISOString(), gf, ga };
}

export function totalsOf(games: SeasonGame[]): SeasonTotals {
  const wins = games.filter((g) => g.gf > g.ga).length;
  const draws = games.filter((g) => g.gf === g.ga).length;
  const gf = games.reduce((n, g) => n + g.gf, 0);
  const ga = games.reduce((n, g) => n + g.ga, 0);
  return { points: wins * 3 + draws, wins, draws, losses: games.length - wins - draws, gf, ga, cleanSheets: games.filter((g) => g.ga === 0).length, gd: gf - ga };
}

const cumulative = (games: SeasonGame[]) => games.reduce<number[]>((a, g) => [...a, (a[a.length - 1] ?? 0) + (g.gf > g.ga ? 3 : g.gf === g.ga ? 1 : 0)], []);
const byDate = (a: SeasonGame, b: SeasonGame) => new Date(a.iso).getTime() - new Date(b.iso).getTime();

/** label musim dari tahun mulai: 2026 → "2026/27" */
export const seasonLabel = (startYear: number) => `${startYear}/${String(startYear + 1).slice(2)}`;

export function aggregate(curRaw: SeasonGame[], prevRaw: SeasonGame[], startYear: number): MusimBody {
  const cur = [...curRaw].sort(byDate);
  const prevAll = [...prevRaw].sort(byDate);
  const n = cur.length;
  const base = { nowLabel: seasonLabel(startYear), prevLabel: seasonLabel(startYear - 1), prevSeason: prevAll.length ? { games: prevAll.length, points: totalsOf(prevAll).points } : null };
  // Tanpa laga musim ini, atau musim lalu lebih pendek dari jumlah laga musim ini, perbandingan tidak adil: kosongkan.
  if (n === 0 || prevAll.length < n) return { n, now: null, prev: null, curveNow: [], curvePrev: [], ...base };
  const prev = prevAll.slice(0, n);
  return { n, now: totalsOf(cur), prev: totalsOf(prev), curveNow: cumulative(cur), curvePrev: cumulative(prev), ...base };
}
