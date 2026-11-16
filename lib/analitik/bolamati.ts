// Analitik → Bola mati: murni fungsi (tanpa fetch), jadi gampang diuji.
// Sumber: FotMob matchDetails → content.shotmap.shots (situasi, xG, kedua tim) + content.matchFacts.events (gol bunuh diri).

export type Kind = 'open' | 'counter' | 'corner' | 'freekick' | 'other' | 'penalty' | 'owngoal';

export const KINDS: { key: Kind; label: string; color: string }[] = [
  { key: 'open', label: 'Permainan terbuka', color: '#9aa0b4' },
  { key: 'counter', label: 'Serangan balik', color: '#f07d22' },
  { key: 'corner', label: 'Sepak pojok', color: '#1f9d55' },
  { key: 'freekick', label: 'Tendangan bebas langsung', color: '#1597b8' },
  { key: 'other', label: 'Situasi bola mati lain', color: '#7a4dff' },
  { key: 'penalty', label: 'Penalti', color: '#ffb000' },
  { key: 'owngoal', label: 'Gol bunuh diri', color: '#5b5f73' },
];

/** Jenis yang dihitung sebagai bola mati. */
export const SET_PIECE: Kind[] = ['corner', 'freekick', 'other', 'penalty'];

export type Counts = Record<Kind, number>;
const zero = (): Counts => ({ open: 0, counter: 0, corner: 0, freekick: 0, other: 0, penalty: 0, owngoal: 0 });

export interface MatchSetPieces {
  id: string;
  leagueId: string;
  leagueName: string;
  /** gol Juventus per jenis (gol bunuh diri lawan masuk 'owngoal') */
  scored: Counts;
  /** gol lawan per jenis (gol bunuh diri Juventus masuk 'owngoal') */
  conceded: Counts;
  /** tembakan dari bola mati: jumlah + xG */
  spFor: { shots: number; xg: number };
  spAgainst: { shots: number; xg: number };
  /** tembakan penalti (termasuk yang gagal) */
  penFor: number;
  penAgainst: number;
}

export interface SetPiecesResponse {
  scored: Counts;
  conceded: Counts;
  totals: {
    scored: number;
    scoredSp: number;
    conceded: number;
    concededSp: number;
    penFor: number;
    penAgainst: number;
    xgFor: number;
    xgAgainst: number;
    shotsFor: number;
    shotsAgainst: number;
    matches: number;
  };
  hasXg: boolean;
  competitions: { id: string; name: string; matches: number }[];
  comp: string;
  warnings: string[];
  updatedAt: string;
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** Situasi tembakan FotMob → jenis. Null = tidak dikenali (diabaikan). */
export function kindOf(situation: string): Kind | null {
  const s = situation.toLowerCase();
  if (!s) return null;
  if (s.includes('penalty')) return 'penalty';
  if (s.includes('corner')) return 'corner';
  if (s.includes('fastbreak') || s.includes('fast break')) return 'counter';
  if (s.includes('freekick') || s.includes('free kick') || s.includes('free_kick')) return 'freekick';
  if (s.includes('regular')) return 'open';
  if (s.includes('setpiece') || s.includes('set piece') || s.includes('throwin') || s.includes('throw')) return 'other';
  return null;
}

/** Ringkas satu pertandingan FotMob → gol/tembakan bola mati kedua tim. Null bila peta tembakan tidak ada. */
export function parseMatchSetPieces(data: any, teamId: string): MatchSetPieces | null {
  const list: any[] = Array.isArray(data?.content?.shotmap?.shots) ? data.content.shotmap.shots : [];
  if (!list.length) return null;
  const juveHome = String(data?.general?.homeTeam?.id) === teamId;
  if (!juveHome && String(data?.general?.awayTeam?.id) !== teamId) return null;

  const m: MatchSetPieces = {
    id: String(data?.general?.matchId ?? ''),
    leagueId: String(data?.general?.leagueId ?? data?.general?.parentLeagueId ?? ''),
    leagueName: String(data?.general?.leagueName ?? data?.general?.parentLeagueName ?? 'Lainnya'),
    scored: zero(),
    conceded: zero(),
    spFor: { shots: 0, xg: 0 },
    spAgainst: { shots: 0, xg: 0 },
    penFor: 0,
    penAgainst: 0,
  };

  for (const s of list) {
    if (s?.isOwnGoal || /own/i.test(String(s?.eventType ?? ''))) continue; // gol bunuh diri dihitung dari kejadian laga
    if (/shootout/i.test(String(s?.period ?? ''))) continue;
    const k = kindOf(String(s?.situation ?? ''));
    if (!k) continue;
    const mine = String(s?.teamId) === teamId;
    const goal = /^goal$/i.test(String(s?.eventType ?? ''));
    if (goal) (mine ? m.scored : m.conceded)[k] += 1;
    if (SET_PIECE.includes(k)) {
      const t = mine ? m.spFor : m.spAgainst;
      t.shots += 1;
      t.xg += num(s?.expectedGoals) ?? 0;
    }
    if (k === 'penalty') {
      if (mine) m.penFor += 1;
      else m.penAgainst += 1;
    }
  }

  // Gol bunuh diri: sisi penerima gol ditentukan dari skor berjalan.
  const events: any[] = Array.isArray(data?.content?.matchFacts?.events?.events) ? data.content.matchFacts.events.events : [];
  const goals = events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => /^goal$/i.test(String(e?.type ?? '')) && !e?.isPenaltyShootoutEvent && !e?.shootoutEventType && num(e?.time) != null)
    .sort((a, b) => (num(a.e.time) as number) - (num(b.e.time) as number) || (num(a.e.overloadTime) ?? 0) - (num(b.e.overloadTime) ?? 0) || a.i - b.i);
  let h = 0;
  let a = 0;
  for (const { e } of goals) {
    const hs = num(e.homeScore);
    const as = num(e.awayScore);
    let homeScored: boolean;
    if (hs != null && as != null && (hs > h || as > a)) {
      homeScored = hs > h;
      h = hs;
      a = as;
    } else {
      homeScored = e.isHome === true;
      if (homeScored) h += 1;
      else a += 1;
    }
    const own = e?.ownGoal === true || (e?.ownGoal != null && e.ownGoal !== false) || /own/i.test(String(e?.eventType ?? e?.goalDescription ?? ''));
    if (own) (homeScored === juveHome ? m.scored : m.conceded).owngoal += 1;
  }
  return m;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function aggregate(matches: MatchSetPieces[]): Pick<SetPiecesResponse, 'scored' | 'conceded' | 'totals' | 'hasXg'> {
  const scored = zero();
  const conceded = zero();
  const t = { scored: 0, scoredSp: 0, conceded: 0, concededSp: 0, penFor: 0, penAgainst: 0, xgFor: 0, xgAgainst: 0, shotsFor: 0, shotsAgainst: 0, matches: matches.length };
  for (const m of matches) {
    for (const { key } of KINDS) {
      scored[key] += m.scored[key];
      conceded[key] += m.conceded[key];
    }
    t.penFor += m.penFor;
    t.penAgainst += m.penAgainst;
    t.xgFor += m.spFor.xg;
    t.xgAgainst += m.spAgainst.xg;
    t.shotsFor += m.spFor.shots;
    t.shotsAgainst += m.spAgainst.shots;
  }
  t.scored = KINDS.reduce((n, k) => n + scored[k.key], 0);
  t.conceded = KINDS.reduce((n, k) => n + conceded[k.key], 0);
  t.scoredSp = SET_PIECE.reduce((n, k) => n + scored[k], 0);
  t.concededSp = SET_PIECE.reduce((n, k) => n + conceded[k], 0);
  return { scored, conceded, totals: { ...t, xgFor: r2(t.xgFor), xgAgainst: r2(t.xgAgainst) }, hasXg: t.xgFor + t.xgAgainst > 0 };
}
