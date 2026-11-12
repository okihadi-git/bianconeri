// Analitik → Kondisi laga: hasil Juventus menurut kandang/tandang, kualitas lawan, jam kick-off (WIB), dan kompetisi.
// Murni fungsi (tanpa fetch). Sumber: FotMob matchDetails (header skor, general, xG dari ./penguasaan).
import { matchXg } from './penguasaan';

/** Lawan "papan atas" untuk kartu "Lawan papan atas". Dicocokkan ke nama tim FotMob; ubah daftar ini kalau definisinya berbeda. */
export const BIG_RIVALS = ['Inter', 'Internazionale', 'AC Milan', 'Milan', 'Napoli', 'Roma', 'AS Roma', 'Lazio', 'Atalanta'];
export const BIG_RIVALS_NOTE = 'Inter, Milan, Napoli, Roma, Lazio, Atalanta';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
const BIG = new Set(BIG_RIVALS.map(norm));
export const isBigRival = (name: string) => BIG.has(norm(name));

export interface CondMatch {
  id: string;
  iso: string;
  opp: string;
  home: boolean;
  gf: number;
  ga: number;
  pts: number;
  xgFor: number | null;
  xgAgainst: number | null;
  /** Serie A vs kompetisi lain (Eropa, piala) */
  serieA: boolean;
  big: boolean;
  /** jam kick-off dalam WIB (0..23) */
  hourWib: number;
}

export interface CondBucket {
  key: string;
  label: string;
  matches: number;
  w: number;
  d: number;
  l: number;
  ppm: number;
  gf: number;
  ga: number;
  xgFor: number | null;
  xgAgainst: number | null;
}

export interface KondisiResponse {
  buckets: CondBucket[];
  matches: number;
  warnings: string[];
  updatedAt: string;
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** Ringkas satu pertandingan FotMob → fakta kondisi laga. Null bila skor atau jam kick-off tidak ada. */
export function parseMatchCondition(data: any, teamId: string): CondMatch | null {
  const home = data?.general?.homeTeam;
  const away = data?.general?.awayTeam;
  const juveHome = String(home?.id) === teamId;
  if (!juveHome && String(away?.id) !== teamId) return null;
  const hs = num(data?.header?.teams?.[0]?.score);
  const as = num(data?.header?.teams?.[1]?.score);
  if (hs == null || as == null) return null;
  const iso = String(data?.general?.matchTimeUTCDate ?? '');
  const t = new Date(iso);
  if (!iso || Number.isNaN(t.getTime())) return null;

  const gf = juveHome ? hs : as;
  const ga = juveHome ? as : hs;
  const opp = String((juveHome ? away?.name : home?.name) ?? '').trim() || 'Lawan';
  const league = `${data?.general?.leagueName ?? ''} ${data?.general?.parentLeagueName ?? ''}`;
  const { xgFor, xgAgainst } = matchXg(data, teamId, juveHome);
  return {
    id: String(data?.general?.matchId ?? ''),
    iso,
    opp,
    home: juveHome,
    gf,
    ga,
    pts: gf > ga ? 3 : gf === ga ? 1 : 0,
    xgFor,
    xgAgainst,
    serieA: /serie a/i.test(league),
    big: isBigRival(opp),
    hourWib: (t.getUTCHours() + 7) % 24,
  };
}

const GROUPS: { key: string; label: string; test: (m: CondMatch) => boolean }[] = [
  { key: 'home', label: 'Kandang', test: (m) => m.home },
  { key: 'away', label: 'Tandang', test: (m) => !m.home },
  { key: 'big', label: 'Lawan papan atas', test: (m) => m.big },
  { key: 'other', label: 'Lawan lainnya', test: (m) => !m.big },
  // 06.00–21.59 WIB / 22.00–00.59 WIB / 01.00–05.59 WIB (jam tengah malam lewat dianggap malam)
  { key: 'ko-early', label: 'Kick-off sebelum 22.00 WIB', test: (m) => m.hourWib >= 6 && m.hourWib < 22 },
  { key: 'ko-mid', label: '22.00–00.59 WIB', test: (m) => m.hourWib >= 22 || m.hourWib === 0 },
  { key: 'ko-late', label: 'Dini hari (01.00 WIB+)', test: (m) => m.hourWib >= 1 && m.hourWib < 6 },
  { key: 'seriea', label: 'Serie A', test: (m) => m.serieA },
  { key: 'cups', label: 'Eropa & piala', test: (m) => !m.serieA },
];

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Kelompokkan laga → statistik per kondisi. Kelompok tanpa laga tidak ditampilkan. */
export function aggregate(ms: CondMatch[]): CondBucket[] {
  return GROUPS.map((g) => {
    const list = ms.filter(g.test);
    const withXg = list.filter((m) => m.xgFor != null && m.xgAgainst != null);
    return {
      key: g.key,
      label: g.label,
      matches: list.length,
      w: list.filter((m) => m.pts === 3).length,
      d: list.filter((m) => m.pts === 1).length,
      l: list.filter((m) => m.pts === 0).length,
      ppm: list.length ? r2(mean(list.map((m) => m.pts)) as number) : 0,
      gf: list.length ? r1(mean(list.map((m) => m.gf)) as number) : 0,
      ga: list.length ? r1(mean(list.map((m) => m.ga)) as number) : 0,
      xgFor: withXg.length ? r2(mean(withXg.map((m) => m.xgFor as number)) as number) : null,
      xgAgainst: withXg.length ? r2(mean(withXg.map((m) => m.xgAgainst as number)) as number) : null,
    };
  }).filter((b) => b.matches > 0);
}
