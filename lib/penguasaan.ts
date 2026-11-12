// Analitik → Penguasaan bola: murni fungsi (tanpa fetch), jadi gampang diuji.
// Sumber: FotMob matchDetails → content.stats (penguasaan bola) + content.shotmap (xG per tembakan, dijumlahkan) + header (skor).

export type Result = 'M' | 'S' | 'K';

export interface PossMatch {
  id: string;
  leagueId: string;
  leagueName: string;
  iso: string;
  opp: string;
  /** 3 huruf untuk label sumbu */
  code: string;
  /** penguasaan bola Juventus, 0..100 */
  poss: number;
  gf: number;
  ga: number;
  pts: number;
  result: Result;
  /** null bila FotMob tidak melaporkan xG laga ini */
  xgFor: number | null;
  xgAgainst: number | null;
}

export interface Bucket {
  key: string;
  label: string;
  matches: number;
  w: number;
  d: number;
  l: number;
  ppm: number;
  gf: number;
  ga: number;
  /** null bila tidak ada laga dengan xG */
  xgFor: number | null;
  xgAgainst: number | null;
}

export interface PossessionResponse {
  matches: PossMatch[];
  avg: number | null;
  high: { poss: number; opp: string } | null;
  low: { poss: number; opp: string } | null;
  atLeast50: { matches: number; ppm: number | null };
  below50: { matches: number; ppm: number | null };
  buckets: Bucket[];
  trend: { r: number; slope: number; intercept: number; n: number } | null;
  competitions: { id: string; name: string; matches: number }[];
  comp: string;
  warnings: string[];
  updatedAt: string;
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace('%', ''));
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

/** xG per laga = jumlah xG per tembakan; kalau peta tembakan tidak ada, pakai statistik xG laga. Null bila FotMob tidak melaporkan. */
export function matchXg(data: any, teamId: string, juveHome: boolean): { xgFor: number | null; xgAgainst: number | null } {
  const stats = data?.content?.stats;
  let xgFor: number | null = null;
  let xgAgainst: number | null = null;
  const shots: any[] = Array.isArray(data?.content?.shotmap?.shots) ? data.content.shotmap.shots : [];
  if (shots.length) {
    let f = 0;
    let a = 0;
    for (const s of shots) {
      if (/shootout/i.test(String(s?.period ?? ''))) continue;
      const x = num(s?.expectedGoals) ?? 0;
      if (String(s?.teamId) === teamId) f += x;
      else a += x;
    }
    if (f + a > 0) {
      xgFor = r2(f);
      xgAgainst = r2(a);
    }
  }
  if (xgFor == null) {
    const x = pair(stats, /^expected_goals$/i, /^expected goals \(xg\)$/i);
    if (x) {
      xgFor = juveHome ? x[0] : x[1];
      xgAgainst = juveHome ? x[1] : x[0];
    }
  }
  return { xgFor, xgAgainst };
}

/** Ringkas satu pertandingan FotMob → penguasaan bola, skor, dan xG. Null bila penguasaan bola atau skor tidak ada. */
export function parseMatchPossession(data: any, teamId: string): PossMatch | null {
  const home = data?.general?.homeTeam;
  const away = data?.general?.awayTeam;
  const juveHome = String(home?.id) === teamId;
  if (!juveHome && String(away?.id) !== teamId) return null;

  const stats = data?.content?.stats;
  const p = pair(stats, /^ball_?possess?ion$/i, /^ball possession$/i);
  if (!p) return null;
  const poss = juveHome ? p[0] : p[1];
  if (!(poss >= 0 && poss <= 100)) return null;

  const hs = num(data?.header?.teams?.[0]?.score);
  const as = num(data?.header?.teams?.[1]?.score);
  if (hs == null || as == null) return null;
  const gf = juveHome ? hs : as;
  const ga = juveHome ? as : hs;

  const { xgFor, xgAgainst } = matchXg(data, teamId, juveHome);

  const opp = String((juveHome ? away?.name : home?.name) ?? '').trim() || 'Lawan';
  const pts = gf > ga ? 3 : gf === ga ? 1 : 0;
  return {
    id: String(data?.general?.matchId ?? ''),
    leagueId: String(data?.general?.leagueId ?? data?.general?.parentLeagueId ?? ''),
    leagueName: String(data?.general?.leagueName ?? data?.general?.parentLeagueName ?? 'Lainnya'),
    iso: String(data?.general?.matchTimeUTCDate ?? ''),
    opp,
    code: opp.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '???',
    poss: Math.round(poss),
    gf,
    ga,
    pts,
    result: pts === 3 ? 'M' : pts === 1 ? 'S' : 'K',
    xgFor,
    xgAgainst,
  };
}

const BUCKETS: { key: string; label: string; test: (p: number) => boolean }[] = [
  { key: 'lt45', label: 'Menguasai < 45%', test: (p) => p < 45 },
  { key: '45-55', label: 'Menguasai 45–55%', test: (p) => p >= 45 && p < 55 },
  { key: '55-65', label: 'Menguasai 55–65%', test: (p) => p >= 55 && p < 65 },
  { key: 'ge65', label: 'Menguasai ≥ 65%', test: (p) => p >= 65 },
];

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Korelasi Pearson + garis tren (kuadrat terkecil) penguasaan bola vs selisih xG. Null bila < 3 laga atau tidak bervariasi. */
export function trendOf(ms: PossMatch[]): PossessionResponse['trend'] {
  const pts = ms.filter((m) => m.xgFor != null && m.xgAgainst != null).map((m) => ({ x: m.poss, y: (m.xgFor as number) - (m.xgAgainst as number) }));
  if (pts.length < 3) return null;
  const mx = mean(pts.map((p) => p.x)) as number;
  const my = mean(pts.map((p) => p.y)) as number;
  const sxx = pts.reduce((n, p) => n + (p.x - mx) ** 2, 0);
  const syy = pts.reduce((n, p) => n + (p.y - my) ** 2, 0);
  const sxy = pts.reduce((n, p) => n + (p.x - mx) * (p.y - my), 0);
  if (sxx === 0 || syy === 0) return null;
  const slope = sxy / sxx;
  return { r: sxy / Math.sqrt(sxx * syy), slope, intercept: my - slope * mx, n: pts.length };
}

/** Gabungkan semua laga → kartu ringkasan, kelompok hasil menurut penguasaan, dan tren. Laga urut dari yang terlama. */
export function aggregate(all: PossMatch[]): Omit<PossessionResponse, 'competitions' | 'comp' | 'warnings' | 'updatedAt'> {
  const matches = [...all].sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());
  const avg = mean(matches.map((m) => m.poss));
  const hi = matches.reduce<PossMatch | null>((b, m) => (!b || m.poss > b.poss ? m : b), null);
  const lo = matches.reduce<PossMatch | null>((b, m) => (!b || m.poss < b.poss ? m : b), null);
  const ge = matches.filter((m) => m.poss >= 50);
  const lt = matches.filter((m) => m.poss < 50);
  const ppm = (ms: PossMatch[]) => (ms.length ? r2((mean(ms.map((m) => m.pts)) as number)) : null);

  const buckets: Bucket[] = BUCKETS.map((b) => {
    const ms = matches.filter((m) => b.test(m.poss));
    const withXg = ms.filter((m) => m.xgFor != null && m.xgAgainst != null);
    return {
      key: b.key,
      label: b.label,
      matches: ms.length,
      w: ms.filter((m) => m.result === 'M').length,
      d: ms.filter((m) => m.result === 'S').length,
      l: ms.filter((m) => m.result === 'K').length,
      ppm: ppm(ms) ?? 0,
      gf: ms.length ? Math.round((mean(ms.map((m) => m.gf)) as number) * 10) / 10 : 0,
      ga: ms.length ? Math.round((mean(ms.map((m) => m.ga)) as number) * 10) / 10 : 0,
      xgFor: withXg.length ? r2(mean(withXg.map((m) => m.xgFor as number)) as number) : null,
      xgAgainst: withXg.length ? r2(mean(withXg.map((m) => m.xgAgainst as number)) as number) : null,
    };
  }).filter((b) => b.matches > 0);

  return {
    matches,
    avg: avg == null ? null : Math.round(avg),
    high: hi ? { poss: hi.poss, opp: hi.opp } : null,
    low: lo ? { poss: lo.poss, opp: lo.opp } : null,
    atLeast50: { matches: ge.length, ppm: ppm(ge) },
    below50: { matches: lt.length, ppm: ppm(lt) },
    buckets,
    trend: trendOf(matches),
  };
}
