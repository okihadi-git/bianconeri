import {
  COMPETITIONS,
  ESPN_BASE,
  JUVE_ID,
  addDays,
  buildRecords,
  competitionName,
  eventState,
  fetchLeagueEvents,
  isCompleted,
  seasonStart,
  toNum,
} from './espn';
import type { Match, MatchEvent } from './types';

const TZ = 'Asia/Jakarta';
const LOOKAHEAD_DAYS = 150;

export function fmtParts(date: Date) {
  const day = new Intl.DateTimeFormat('id-ID', { day: 'numeric', timeZone: TZ }).format(date);
  const month = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: TZ }).format(date);
  const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: TZ }).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TZ,
  }).format(date);
  return {
    dateLabel: `${day} ${month.replace('.', '')}`.toUpperCase(),
    dayTime: `${weekday.replace('.', '')} · ${time}`,
  };
}

export function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: TZ }).format(date);
}

/** Gol (kedua tim) dan kartu merah, urut sesuai kejadian — seperti ringkasan skor ESPN. */
function matchEvents(event: any): MatchEvent[] {
  const details: any[] = event?.competitions?.[0]?.details ?? [];
  const out: MatchEvent[] = [];
  for (const d of details) {
    const isRed = Boolean(d.redCard) || /red card/i.test(d.type?.text ?? '');
    const isGoal = Boolean(d.scoringPlay);
    if (!isRed && !isGoal) continue;
    const raw = String(d.clock?.displayValue ?? '').replace(/′/g, "'");
    out.push({
      kind: isGoal ? 'goal' : 'red',
      side: String(d.team?.id) === JUVE_ID ? 'juve' : 'opp',
      name: d.athletesInvolved?.[0]?.displayName || d.athletesInvolved?.[0]?.shortName || '',
      minute: raw && !raw.endsWith("'") ? `${raw}'` : raw,
      tag: isGoal ? (d.penaltyKick ? 'pen' : d.ownGoal ? 'og' : '') : '',
    });
  }
  return out;
}

function shootoutOf(juve: any, opp: any): { juve: number; opp: number } | null {
  const a = juve?.shootoutScore;
  const b = opp?.shootoutScore;
  if (a === undefined || a === null || b === undefined || b === null) return null;
  return { juve: toNum(a), opp: toNum(b) };
}

/**
 * Juventus menang? Skor beda → jelas. Skor sama → lihat adu penalti, lalu flag `winner` ESPN
 * (hanya dipercaya kalau kedua tim berbeda). Laga liga yang seri tetap null.
 */
function winnerOf(juve: any, opp: any, juveScore: number, oppScore: number): boolean | null {
  if (juveScore !== oppScore) return juveScore > oppScore;
  const so = shootoutOf(juve, opp);
  if (so && so.juve !== so.opp) return so.juve > so.opp;
  if (typeof juve?.winner === 'boolean' && typeof opp?.winner === 'boolean' && juve.winner !== opp.winner) return juve.winner;
  return null;
}

export const isJuveEvent = (e: any) =>
  (e?.competitions?.[0]?.competitors ?? []).some((c: any) => String(c.team?.id) === JUVE_ID);

/** Cadangan bila scoreboard kosong: jadwal tim lintas kompetisi. */
async function fetchTeamScheduleFallback(): Promise<any[]> {
  const urls = [
    `${ESPN_BASE}/site/v2/sports/soccer/all/teams/${JUVE_ID}/schedule?fixture=true`,
    `${ESPN_BASE}/site/v2/sports/soccer/all/teams/${JUVE_ID}/schedule`,
    `${ESPN_BASE}/site/v2/sports/soccer/ita.1/teams/${JUVE_ID}/schedule`,
  ];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { next: { revalidate: 1800 } });
      if (!res.ok) continue;
      const data = await res.json();
      for (const e of data?.events ?? []) {
        if (seen.has(String(e.id))) continue;
        seen.add(String(e.id));
        out.push({ ...e, _league: e.league?.slug ?? 'ita.1' });
      }
    } catch {
      /* coba URL berikutnya */
    }
  }
  return out;
}

/** Semua pertandingan Juventus musim ini di semua kompetisi. */
export async function loadJuve() {
  const from = seasonStart();
  const to = addDays(new Date(), LOOKAHEAD_DAYS);

  const perLeague = await Promise.all(COMPETITIONS.map((c) => fetchLeagueEvents(c.slug, from, to)));
  const byLeague: Record<string, any[]> = {};
  COMPETITIONS.forEach((c, i) => (byLeague[c.slug] = perLeague[i]));

  let source: 'scoreboard' | 'schedule' = 'scoreboard';
  let events = perLeague.flat().filter(isJuveEvent);
  if (!events.length) {
    source = 'schedule';
    events = await fetchTeamScheduleFallback();
  }

  const debug = {
    source,
    scoreboardEvents: Object.fromEntries(COMPETITIONS.map((c, i) => [c.slug, perLeague[i].length])),
    juventusEvents: events.length,
  };

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const serieAWeek: Record<string, number> = {};
  events.filter((e) => e._league === 'ita.1').forEach((e, i) => (serieAWeek[String(e.id)] = i + 1));
  const records = buildRecords(byLeague['ita.1'] ?? []);

  const upcoming: Match[] = [];
  const past: Match[] = [];

  for (const event of events) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    const juve = competition.competitors.find((c: any) => String(c.team.id) === JUVE_ID);
    const opp = competition.competitors.find((c: any) => String(c.team.id) !== JUVE_ID);
    const date = new Date(event.date);
    const isHome = juve?.homeAway === 'home';
    const done = isCompleted(event);
    const juveScore = toNum(juve?.score);
    const oppScore = toNum(opp?.score);
    const rec = records[String(event.id)];

    const match: Match = {
      id: String(event.id),
      league: event._league as string,
      competition: competitionName(event._league),
      week: serieAWeek[String(event.id)] ?? null,
      iso: date.toISOString(),
      ...fmtParts(date),
      opponentId: String(opp?.team?.id ?? ''),
      opponent: opp?.team?.displayName || 'TBA',
      opponentAbbr: opp?.team?.abbreviation || '',
      opponentLogo: opp?.team?.logos?.[0]?.href || opp?.team?.logo || '',
      isHome,
      venueText: isHome ? 'KANDANG' : 'TANDANG',
      venue: competition.venue?.fullName || '',
      juveScore,
      opponentScore: oppScore,
      result: done ? (juveScore > oppScore ? 'W' : juveScore === oppScore ? 'D' : 'L') : null,
      events: done ? matchEvents(event) : [],
      records: rec ? { juve: rec[JUVE_ID], opp: rec[String(opp?.team?.id)] } : null,
      round: String(competition.notes?.[0]?.headline ?? ''),
      status: eventState(event),
      winner: done ? winnerOf(juve, opp, juveScore, oppScore) : null,
      shootout: shootoutOf(juve, opp),
    };
    (done ? past : upcoming).push(match);
  }

  past.reverse(); // hasil terbaru di atas
  return { upcoming, past, debug, juveEvents: events };
}
