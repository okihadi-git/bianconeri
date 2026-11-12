// Pusat laga: daftar laga Juventus yang sudah selesai dan analisis satu laga dari ringkasan + komentar ESPN.
import { loadJuve } from './juve';
import { buildLiveMatch, fetchSummary } from './live';
import { teamStrengths } from './peluang';
import { loadSeason } from './peluang-server';
import {
  momentum,
  parseCommentary,
  parseMinute,
  scaleXg,
  winProbability,
  type GoalEvent,
  type MomentumBar,
  type RawComment,
  type Shot,
  type Side,
  type WinPoint,
} from './pusatlaga';

export interface LagaListItem {
  id: string;
  league: string;
  label: string;
  iso: string;
}

export interface LagaTeam {
  name: string;
  logo: string;
  score: number;
}

export interface LagaDetail {
  id: string;
  league: string;
  competition: string;
  dateLabel: string;
  statusText: string;
  juve: LagaTeam;
  opp: LagaTeam;
  juveIsHome: boolean;
  /** [Juventus, lawan] */
  stats: {
    xg: [number, number];
    xgOfficial: boolean;
    shots: [number, number];
    onTarget: [number, number];
    bigChances: [number, number];
  };
  shots: Shot[];
  hasCommentary: boolean;
  momentum: { bars: MomentumBar[]; juveShare: number | null };
  winProb: WinPoint[];
  goals: GoalEvent[];
  priorLabel: string;
  warnings: string[];
}

export async function fetchLagaList(): Promise<LagaListItem[] | null> {
  try {
    const juve = await loadJuve();
    return juve.past
      .filter((m) => m.status === 'post')
      .sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
      .slice(0, 30)
      .map((m) => ({ id: m.id, league: m.league, iso: m.iso, label: `${m.dateLabel} · vs ${m.opponent} ${m.juveScore}-${m.opponentScore} · ${m.competition}` }));
  } catch {
    return null;
  }
}

/** Nilai satu statistik tim dari boxscore ESPN berdasarkan nama (regex), atau null. */
function stat(team: any, re: RegExp): number | null {
  const s = (team?.statistics ?? []).find((x: any) => re.test(String(x?.name ?? '')));
  const v = parseFloat(String(s?.displayValue ?? s?.value ?? ''));
  return Number.isFinite(v) ? v : null;
}

export async function fetchLagaDetail(id: string, league: string): Promise<LagaDetail | null> {
  const summary = await fetchSummary(league, id, false);
  const comp = summary?.header?.competitions?.[0];
  if (!summary || !comp) return null;

  const live = buildLiveMatch({ id, date: comp.date ?? summary?.header?.gameDate, _league: league, competitions: [comp] }, summary);
  const juveSide = live.home.isJuve ? live.home : live.away.isJuve ? live.away : null;
  if (!juveSide) return null;
  const oppSide = juveSide === live.home ? live.away : live.home;
  const juveIsHome = juveSide === live.home;
  const warnings: string[] = [];

  /* komentar → tembakan, tekanan, gol */
  const comments: RawComment[] = (summary.commentary ?? [])
    .map((x: any) => ({ text: String(x?.text ?? ''), ...parseMinute(String(x?.time?.displayValue ?? x?.clock?.displayValue ?? '')) }))
    .filter((c: RawComment) => c.text);
  const hasCommentary = comments.length > 0;
  const parsed = parseCommentary(comments, oppSide.name);
  if (!hasCommentary) warnings.push('ESPN tidak menyediakan komentar laga ini, jadi peta tembakan dan momentum tidak bisa dibuat.');

  /* statistik resmi */
  const boxTeams: any[] = summary?.boxscore?.teams ?? [];
  const tJ = boxTeams.find((t) => String(t?.team?.id) === juveSide.id);
  const tO = boxTeams.find((t) => String(t?.team?.id) === oppSide.id);
  const xgJ = stat(tJ, /expected.?goals|^xg$/i);
  const xgO = stat(tO, /expected.?goals|^xg$/i);
  scaleXg(parsed.shots, { juve: xgJ, opp: xgO }); // total xG tiap tim disamakan dengan xG resmi bila ada
  const xgOfficial = xgJ !== null && xgO !== null;
  const sum = (side: Side) => parsed.shots.filter((s) => s.team === side).reduce((n, s) => n + s.xg, 0);
  const count = (side: Side, f: (s: Shot) => boolean) => parsed.shots.filter((s) => s.team === side && f(s)).length;
  const shotsJ = stat(tJ, /^totalShots$/i) ?? count('juve', () => true);
  const shotsO = stat(tO, /^totalShots$/i) ?? count('opp', () => true);
  const onJ = stat(tJ, /^shotsOnTarget$/i) ?? count('juve', (s) => s.onTarget);
  const onO = stat(tO, /^shotsOnTarget$/i) ?? count('opp', (s) => s.onTarget);
  if (!xgOfficial && hasCommentary) warnings.push('ESPN tidak menyediakan xG resmi untuk laga ini, jadi xG adalah estimasi dari lokasi tembakan.');

  /* gol: dari komentar; kalau tidak cocok dengan skor akhir, pakai lini masa laga */
  let goals: GoalEvent[] = parsed.goals;
  const cJ = goals.filter((g) => g.team === 'juve').length;
  const cO = goals.filter((g) => g.team === 'opp').length;
  if (cJ !== juveSide.score || cO !== oppSide.score) {
    const fromTimeline: GoalEvent[] = live.timeline
      .filter((t) => t.kind === 'goal' || t.kind === 'pen-goal' || t.kind === 'own-goal')
      .map((t) => ({ minute: parseMinute(t.minute).minute, team: ((t.side === 'home') === juveIsHome ? 'juve' : 'opp') as Side, player: t.player }));
    const tJ2 = fromTimeline.filter((g) => g.team === 'juve').length;
    const tO2 = fromTimeline.filter((g) => g.team === 'opp').length;
    if (tJ2 === juveSide.score && tO2 === oppSide.score) goals = fromTimeline;
    else warnings.push('Daftar gol dari ESPN tidak cocok dengan skor akhir, jadi kurva peluang menang bisa kurang tepat.');
  }

  /* laju awal tiap tim (per 90 menit) dari kekuatan musim ini di Serie A */
  let prior = { juve: juveIsHome ? 1.45 : 1.15, opp: juveIsHome ? 1.15 : 1.45 };
  let priorLabel = 'rata-rata liga';
  try {
    const season = await loadSeason('ita.1');
    if (season) {
      const { rows, muHome, muAway } = season;
      const { att, def } = teamStrengths(rows, muHome, muAway);
      const ji = rows.findIndex((r) => r.id === juveSide.id);
      const oi = rows.findIndex((r) => r.id === oppSide.id);
      if (ji >= 0) {
        const aJ = att[ji];
        const dJ = def[ji];
        const aO = oi >= 0 ? att[oi] : 1;
        const dO = oi >= 0 ? def[oi] : 1;
        prior = juveIsHome ? { juve: muHome * aJ * dO, opp: muAway * aO * dJ } : { juve: muAway * aJ * dO, opp: muHome * aO * dJ };
        priorLabel = oi >= 0 ? 'gol musim ini di Serie A' : 'gol Juventus musim ini di Serie A dan rata-rata lawan';
      }
    }
  } catch {
    /* pakai rata-rata liga */
  }

  return {
    id,
    league,
    competition: live.competition,
    dateLabel: live.dateLabel,
    statusText: live.statusText,
    juve: { name: juveSide.name, logo: juveSide.logo, score: juveSide.score },
    opp: { name: oppSide.name, logo: oppSide.logo, score: oppSide.score },
    juveIsHome,
    stats: {
      xg: [sum('juve'), sum('opp')],
      xgOfficial,
      shots: [shotsJ, shotsO],
      onTarget: [onJ, onO],
      bigChances: [count('juve', (s) => s.big), count('opp', (s) => s.big)],
    },
    shots: parsed.shots,
    hasCommentary,
    momentum: momentum(parsed.shots, parsed.pressure, Math.max(90, ...comments.map((c) => c.minute))),
    winProb: winProbability({ goals, shots: parsed.shots, prior }),
    goals,
    priorLabel,
    warnings,
  };
}
