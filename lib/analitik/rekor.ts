// Analitik → 08 Rekor beruntun: murni fungsi (tanpa fetch), jadi gampang diuji.
// Sumber: FotMob matchDetails → general (tim, kompetisi, waktu) + header (skor). Hanya laga resmi yang sudah selesai.
// Adu penalti tidak mengubah hasil: skor setelah 90/120 menit yang dipakai (seri = S).

export type Result = 'M' | 'S' | 'K';

export interface RekorMatch {
  id: string;
  leagueId: string;
  leagueName: string;
  iso: string;
  opp: string;
  home: boolean;
  gf: number;
  ga: number;
  result: Result;
}

export interface StreakCard {
  key: string;
  label: string;
  /** rentetan yang sedang berjalan (0 = sudah putus) */
  now: number;
  /** rentetan terpanjang musim ini */
  best: number;
}

export interface FormChip {
  id: string;
  result: Result;
  opp: string;
  score: string;
  comp: string;
  home: boolean;
}

/** Rekor kemenangan terbanyak dalam satu musim Serie A: Juventus 2013/14, 33 dari 38 laga. */
export const TARGET_WINS = 33;
export const TARGET_SEASON = '2013/14';
export const SEASON_GAMES = 38;

export interface TargetInfo {
  season: string;
  goal: number;
  wins: number;
  played: number;
  /** sisa laga liga (38 − dimainkan) */
  left: number;
  /** kemenangan yang masih dibutuhkan untuk menyamai rekor */
  need: number;
  /** false bila sisa laga tidak cukup lagi untuk menyamai rekor */
  reachable: boolean;
}

export interface RekorBody {
  chips: FormChip[];
  cards: StreakCard[];
  leagueName: string | null;
  target: TargetInfo | null;
  total: number;
}

export interface RekorResponse extends RekorBody {
  warnings: string[];
  updatedAt: string;
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** Ringkas satu pertandingan FotMob → hasil. Null bila belum selesai, dibatalkan, atau skornya tidak ada. */
export function parseMatchResult(data: any, teamId: string): RekorMatch | null {
  const home = data?.general?.homeTeam;
  const away = data?.general?.awayTeam;
  const juveHome = String(home?.id) === teamId;
  if (!juveHome && String(away?.id) !== teamId) return null;
  const st = data?.header?.status;
  if (st && (st.finished === false || st.cancelled === true)) return null;

  const hs = num(data?.header?.teams?.[0]?.score);
  const as = num(data?.header?.teams?.[1]?.score);
  if (hs == null || as == null) return null;
  const gf = juveHome ? hs : as;
  const ga = juveHome ? as : hs;
  return {
    id: String(data?.general?.matchId ?? ''),
    leagueId: String(data?.general?.leagueId ?? data?.general?.parentLeagueId ?? ''),
    leagueName: String(data?.general?.leagueName ?? data?.general?.parentLeagueName ?? 'Lainnya'),
    iso: String(data?.general?.matchTimeUTCDate ?? ''),
    opp: String((juveHome ? away?.name : home?.name) ?? '').trim() || 'Lawan',
    home: juveHome,
    gf,
    ga,
    result: gf > ga ? 'M' : gf === ga ? 'S' : 'K',
  };
}

/** Serie A putra saja (bukan Serie A Women / Next Gen). */
export const isSerieA = (name: string) => /\bserie a\b/i.test(name) && !/women|femminile|next/i.test(name);

/** Rentetan berturut-turut yang memenuhi `ok`, dihitung pada daftar yang sudah urut waktu. */
export function streakOf(list: RekorMatch[], ok: (m: RekorMatch) => boolean): { now: number; best: number } {
  let now = 0;
  let best = 0;
  for (const m of list) {
    now = ok(m) ? now + 1 : 0;
    if (now > best) best = now;
  }
  return { now, best };
}

export function aggregate(input: RekorMatch[]): RekorBody {
  const ms = input.filter((m) => m.iso).sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());
  const serieA = ms.filter((m) => isSerieA(m.leagueName));
  const leagueName = serieA[0]?.leagueName ?? null;

  const defs: [string, string, RekorMatch[], (m: RekorMatch) => boolean][] = [
    ['unbeaten', 'Tak terkalahkan', ms, (m) => m.result !== 'K'],
    ['wins', 'Menang beruntun', ms, (m) => m.result === 'M'],
    ['cleansheet', 'Clean sheet', ms, (m) => m.ga === 0],
    ['scoring', 'Selalu cetak gol', ms, (m) => m.gf > 0],
    ['home', 'Kandang tak terkalahkan', ms.filter((m) => m.home), (m) => m.result !== 'K'],
  ];
  if (leagueName) defs.push(['league', `${leagueName} tak terkalahkan`, serieA, (m) => m.result !== 'K']);

  const wins = serieA.filter((m) => m.result === 'M').length;
  const left = Math.max(0, SEASON_GAMES - serieA.length);
  const need = Math.max(0, TARGET_WINS - wins);
  return {
    chips: ms.map((m) => ({ id: m.id, result: m.result, opp: m.opp, score: `${m.gf}-${m.ga}`, comp: m.leagueName, home: m.home })),
    cards: defs.map(([key, label, list, ok]) => ({ key, label, ...streakOf(list, ok) })),
    leagueName,
    target: serieA.length ? { season: TARGET_SEASON, goal: TARGET_WINS, wins, played: serieA.length, left, need, reachable: need <= left } : null,
    total: ms.length,
  };
}
