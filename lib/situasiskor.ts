// Analitik → Situasi skor: murni fungsi (tanpa fetch), jadi gampang diuji.
// Sumber: FotMob matchDetails → content.matchFacts.events.events (gol: menit + skor berjalan). ESPN tidak dipakai di sini.

export type State = 'lead' | 'level' | 'trail';

export interface GoalEv {
  /** menit nyata sejak kick-off (sudah memperhitungkan tambahan waktu babak 1) untuk posisi di garis waktu */
  t: number;
  /** label menit untuk tooltip, mis. 45+2' */
  label: string;
  /** menit tampilan untuk pengelompokan 15 menit */
  min: number;
  side: 'juve' | 'opp';
  who: string;
}

export interface Segment {
  from: number;
  to: number;
  state: State;
}

export interface MatchFlow {
  id: string;
  leagueId: string;
  leagueName: string;
  iso: string;
  opp: string;
  duration: number;
  goals: GoalEv[];
  segments: Segment[];
  juve: number;
  opp_: number;
  /** poin yang didapat Juventus */
  pts: number;
  led: boolean;
  trailed: boolean;
  /** siapa mencetak gol pertama */
  first: 'juve' | 'opp' | null;
}

export interface MatchRow {
  id: string;
  iso: string;
  opp: string;
  duration: number;
  goals: GoalEv[];
  segments: Segment[];
  juve: number;
  against: number;
  result: 'M' | 'S' | 'K';
}

export interface SituasiSkorResponse {
  minutes: { total: number; lead: number; level: number; trail: number };
  lostFromLead: { points: number; matches: number };
  fromTrailing: { points: number; matches: number };
  scoredFirst: { w: number; d: number; l: number };
  concededFirst: { w: number; d: number; l: number };
  /** bin 15 menit: 0-15, 16-30, 31-45, 46-60, 61-75, 76-90+ */
  bins: { label: string; scored: number; conceded: number }[];
  matches: MatchRow[];
  competitions: { id: string; name: string; matches: number }[];
  comp: string;
  warnings: string[];
  updatedAt: string;
}

export const BIN_LABELS = ["0-15'", "16-30'", "31-45'", "46-60'", "61-75'", "76-90+'"];

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export const binOf = (min: number) => (min <= 15 ? 0 : min <= 30 ? 1 : min <= 45 ? 2 : min <= 60 ? 3 : min <= 75 ? 4 : 5);

/** Ringkas satu pertandingan FotMob → alur skor Juventus. Null bila kejadian gol tidak lengkap/tidak ada. */
export function parseMatchFlow(data: any, teamId: string): MatchFlow | null {
  const events: any[] = data?.content?.matchFacts?.events?.events;
  if (!Array.isArray(events)) return null;
  const home = data?.general?.homeTeam;
  const away = data?.general?.awayTeam;
  const juveHome = String(home?.id) === teamId;
  if (!juveHome && String(away?.id) !== teamId) return null;
  const opp = String((juveHome ? away?.name : home?.name) ?? '').trim() || 'Lawan';

  // Tambahan waktu: dari kejadian "Half" bila ada, kalau tidak batas bawah dari menit tambahan kejadian lain.
  let htAdd = 0;
  let ftAdd = 0;
  let extra = /AET|PEN/i.test(String(data?.header?.status?.reason?.short ?? ''));
  for (const e of events) {
    const time = num(e?.time);
    const over = num(e?.overloadTime) ?? 0;
    if (time == null) continue;
    if (time > 90) extra = true;
    if (time === 45) htAdd = Math.max(htAdd, over);
    if (time === 90) ftAdd = Math.max(ftAdd, over);
  }
  const duration = (extra ? 120 : 90) + htAdd + ftAdd;

  const real = (time: number, over: number) => (time <= 45 ? time + over : time <= 90 ? time + htAdd + over : time + htAdd + ftAdd + over);

  const goalEvents = events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => /^goal$/i.test(String(e?.type ?? '')) && !e?.isPenaltyShootoutEvent && !e?.shootoutEventType && num(e?.time) != null && (num(e?.time) as number) <= 130)
    .sort((a, b) => real(a.e.time, num(a.e.overloadTime) ?? 0) - real(b.e.time, num(b.e.overloadTime) ?? 0) || a.i - b.i);

  let h = 0;
  let a = 0;
  const goals: GoalEv[] = [];
  for (const { e } of goalEvents) {
    const time = num(e.time) as number;
    const over = num(e.overloadTime) ?? 0;
    const hs = num(e.homeScore);
    const as = num(e.awayScore);
    let homeScored: boolean;
    if (hs != null && as != null && (hs > h || as > a)) homeScored = hs > h;
    else homeScored = e.isHome === true;
    if (hs != null && as != null && (hs > h || as > a)) {
      h = hs;
      a = as;
    } else if (homeScored) h += 1;
    else a += 1;
    const side: 'juve' | 'opp' = homeScored === juveHome ? 'juve' : 'opp';
    goals.push({
      t: Math.min(duration, real(time, over)),
      label: over ? `${time}+${over}'` : `${time}'`,
      min: time,
      side,
      who: String(e?.player?.name ?? e?.nameStr ?? e?.fullName ?? '').trim(),
    });
  }

  // Skor akhir di header (bila ada) harus sama dengan jumlah gol yang kita temukan, kalau tidak datanya tidak lengkap.
  const hh = num(data?.header?.teams?.[0]?.score);
  const ha = num(data?.header?.teams?.[1]?.score);
  if (hh != null && ha != null && (hh !== h || ha !== a)) return null;

  const juve = juveHome ? h : a;
  const against = juveHome ? a : h;

  const segments: Segment[] = [];
  let from = 0;
  let diff = 0;
  const st = (d: number): State => (d > 0 ? 'lead' : d < 0 ? 'trail' : 'level');
  let led = false;
  let trailed = false;
  for (const g of goals) {
    if (g.t > from) segments.push({ from, to: g.t, state: st(diff) });
    from = Math.max(from, g.t);
    diff += g.side === 'juve' ? 1 : -1;
    if (diff > 0) led = true;
    if (diff < 0) trailed = true;
  }
  if (duration > from) segments.push({ from, to: duration, state: st(diff) });

  return {
    id: String(data?.general?.matchId ?? ''),
    leagueId: String(data?.general?.leagueId ?? data?.general?.parentLeagueId ?? ''),
    leagueName: String(data?.general?.leagueName ?? data?.general?.parentLeagueName ?? 'Lainnya'),
    iso: String(data?.general?.matchTimeUTCDate ?? data?.general?.matchTimeUTC ?? ''),
    opp,
    duration,
    goals,
    segments,
    juve,
    opp_: against,
    pts: juve > against ? 3 : juve === against ? 1 : 0,
    led,
    trailed,
    first: goals[0]?.side ?? null,
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Gabungkan semua laga → kartu ringkasan, bar waktu, gol per 15 menit, dan daftar alur skor (terbaru dulu). */
export function aggregate(flows: MatchFlow[]): Omit<SituasiSkorResponse, 'competitions' | 'comp' | 'warnings' | 'updatedAt'> {
  const minutes = { total: 0, lead: 0, level: 0, trail: 0 };
  const lost = { points: 0, matches: 0 };
  const back = { points: 0, matches: 0 };
  const sf = { w: 0, d: 0, l: 0 };
  const cf = { w: 0, d: 0, l: 0 };
  const bins = BIN_LABELS.map((label) => ({ label, scored: 0, conceded: 0 }));

  for (const m of flows) {
    for (const s of m.segments) {
      const len = s.to - s.from;
      minutes.total += len;
      minutes[s.state === 'lead' ? 'lead' : s.state === 'trail' ? 'trail' : 'level'] += len;
    }
    if (m.led && m.pts < 3) {
      lost.points += 3 - m.pts;
      lost.matches += 1;
    }
    if (m.trailed && m.pts > 0) {
      back.points += m.pts;
      back.matches += 1;
    }
    if (m.first) {
      const bucket = m.first === 'juve' ? sf : cf;
      if (m.pts === 3) bucket.w += 1;
      else if (m.pts === 1) bucket.d += 1;
      else bucket.l += 1;
    }
    for (const g of m.goals) bins[binOf(g.min)][g.side === 'juve' ? 'scored' : 'conceded'] += 1;
  }

  const matches: MatchRow[] = [...flows]
    .sort((x, y) => new Date(y.iso).getTime() - new Date(x.iso).getTime())
    .map((m) => ({
      id: m.id,
      iso: m.iso,
      opp: m.opp,
      duration: m.duration,
      goals: m.goals,
      segments: m.segments,
      juve: m.juve,
      against: m.opp_,
      result: m.pts === 3 ? 'M' : m.pts === 1 ? 'S' : 'K',
    }));

  return {
    minutes: { total: r1(minutes.total), lead: r1(minutes.lead), level: r1(minutes.level), trail: r1(minutes.trail) },
    lostFromLead: lost,
    fromTrailing: back,
    scoredFirst: sf,
    concededFirst: cf,
    bins,
    matches,
  };
}
