// Analitik → 09 Jadwal padat: murni fungsi (tanpa fetch), jadi gampang diuji.
// Sumber: FotMob matchDetails → general (tim, kompetisi, waktu), header (skor), shotmap/stats (xG).
// Jeda = selisih waktu kick-off dengan laga resmi sebelumnya (semua kompetisi), dibulatkan ke hari.
// Laga pertama musim (belum ada laga resmi sebelumnya) dan jeda di atas 28 hari tidak punya jeda yang berarti.

export type Result = 'M' | 'S' | 'K';

export interface PadatMatch {
  id: string;
  leagueName: string;
  iso: string;
  opp: string;
  gf: number;
  ga: number;
  result: Result;
  /** null bila FotMob tidak melaporkan xG laga ini */
  xgFor: number | null;
  xgAgainst: number | null;
}

export interface PadatBucket {
  key: string;
  label: string;
  matches: number;
  /** poin per laga */
  ppm: number | null;
  /** rata-rata selisih xG per laga (hanya laga yang punya xG); null bila tidak ada */
  xgDiff: number | null;
  xgMatches: number;
}

export interface PadatPoint {
  id: string;
  rest: number;
  xgd: number;
  result: Result;
  opp: string;
  score: string;
}

export interface PadatBody {
  buckets: PadatBucket[];
  points: PadatPoint[];
  /** laga resmi selesai yang dihitung */
  total: number;
  /** laga yang punya jeda */
  withRest: number;
  withXg: number;
}

export interface PadatResponse extends PadatBody {
  warnings: string[];
  updatedAt: string;
}

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

/** Ringkas satu pertandingan FotMob. Null bila bukan laga Juventus, belum selesai, atau skornya tidak ada. */
export function parseMatchPadat(data: any, teamId: string): PadatMatch | null {
  const home = data?.general?.homeTeam;
  const away = data?.general?.awayTeam;
  const juveHome = String(home?.id) === teamId;
  if (!juveHome && String(away?.id) !== teamId) return null;
  const st = data?.header?.status;
  if (st && (st.finished === false || st.cancelled === true)) return null;

  const hs = num(data?.header?.teams?.[0]?.score);
  const as = num(data?.header?.teams?.[1]?.score);
  const iso = String(data?.general?.matchTimeUTCDate ?? '');
  if (hs == null || as == null || !iso) return null;
  const gf = juveHome ? hs : as;
  const ga = juveHome ? as : hs;

  // xG per laga = jumlah xG per tembakan (adu penalti tidak dihitung); cadangan: statistik xG laga.
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
    const x = pair(data?.content?.stats, /^expected_goals$/i, /^expected goals \(xg\)$/i);
    if (x) {
      xgFor = juveHome ? x[0] : x[1];
      xgAgainst = juveHome ? x[1] : x[0];
    }
  }

  return {
    id: String(data?.general?.matchId ?? ''),
    leagueName: String(data?.general?.leagueName ?? data?.general?.parentLeagueName ?? 'Lainnya'),
    iso,
    opp: String((juveHome ? away?.name : home?.name) ?? '').trim() || 'Lawan',
    gf,
    ga,
    result: gf > ga ? 'M' : gf === ga ? 'S' : 'K',
    xgFor,
    xgAgainst,
  };
}

/** Nama kompetisi Eropa untuk label kartu; null bila bukan laga Eropa. Kualifikasi ikut dihitung. */
export function euroName(leagueName: string): string | null {
  if (/women|femminile|youth|u\d\d/i.test(leagueName)) return null;
  if (/champions league/i.test(leagueName)) return 'Liga Champions';
  if (/europa league/i.test(leagueName)) return 'Liga Europa';
  if (/conference league/i.test(leagueName)) return 'Liga Konferensi';
  return null;
}

const MAX_REST = 28;
const pts = (r: Result) => (r === 'M' ? 3 : r === 'S' ? 1 : 0);

function bucketOf(key: string, label: string, list: PadatMatch[]): PadatBucket {
  const xg = list.filter((m) => m.xgFor != null && m.xgAgainst != null);
  return {
    key,
    label,
    matches: list.length,
    ppm: list.length ? r2(list.reduce((n, m) => n + pts(m.result), 0) / list.length) : null,
    xgDiff: xg.length ? r2(xg.reduce((n, m) => n + ((m.xgFor as number) - (m.xgAgainst as number)), 0) / xg.length) : null,
    xgMatches: xg.length,
  };
}

export function aggregate(input: PadatMatch[]): PadatBody {
  const ms = input.filter((m) => m.iso).sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());
  const rows = ms.map((m, i) => {
    const prev = i > 0 ? ms[i - 1] : null;
    const days = prev ? Math.round((new Date(m.iso).getTime() - new Date(prev.iso).getTime()) / 86400000) : null;
    return { m, rest: days != null && days <= MAX_REST ? days : null, prevEuro: prev ? euroName(prev.leagueName) : null };
  });
  const withRest = rows.filter((r) => r.rest != null);
  const of = (f: (r: number) => boolean) => withRest.filter((r) => f(r.rest as number)).map((r) => r.m);

  const afterEuro = rows.filter((r) => r.prevEuro).map((r) => r);
  const euroNames = [...new Set(afterEuro.map((r) => r.prevEuro as string))];
  const euroLabel = euroNames.length === 1 ? `Setelah laga ${euroNames[0]}` : 'Setelah laga Eropa';

  const buckets = [
    bucketOf('le3', '≤ 3 hari', of((d) => d <= 3)),
    bucketOf('d45', '4–5 hari', of((d) => d >= 4 && d <= 5)),
    bucketOf('ge6', '6+ hari', of((d) => d >= 6)),
    bucketOf('euro', euroLabel, afterEuro.map((r) => r.m)),
  ].filter((b) => b.matches > 0);

  const points: PadatPoint[] = withRest
    .filter((r) => r.m.xgFor != null && r.m.xgAgainst != null)
    .map((r) => ({ id: r.m.id, rest: r.rest as number, xgd: r2((r.m.xgFor as number) - (r.m.xgAgainst as number)), result: r.m.result, opp: r.m.opp, score: `${r.m.gf}-${r.m.ga}` }));

  return { buckets, points, total: ms.length, withRest: withRest.length, withXg: ms.filter((m) => m.xgFor != null && m.xgAgainst != null).length };
}
