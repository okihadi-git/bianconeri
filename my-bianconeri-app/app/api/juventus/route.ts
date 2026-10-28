import { NextResponse } from 'next/server';
import { ESPN_BASE, JUVE_ID, fetchSeasonEvents, isCompleted, seasonWindow, toNum } from '@/lib/espn';

const TZ = 'Asia/Jakarta';

function fmtParts(date: Date) {
  const day = new Intl.DateTimeFormat('id-ID', { day: 'numeric', timeZone: TZ }).format(date);
  const month = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: TZ }).format(date);
  const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: TZ }).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TZ,
  }).format(date); // "23:30"
  return {
    dateLabel: `${day} ${month.replace('.', '')}`.toUpperCase(),
    dayTime: `${weekday.replace('.', '')} · ${time}`,
  };
}

/** Pencetak gol Juventus per event dari data scoreboard. */
function scorersOf(event: any) {
  const details: any[] = event?.competitions?.[0]?.details ?? [];
  return details
    .filter((d) => d.scoringPlay && String(d.team?.id) === JUVE_ID)
    .map((d) => {
      const name = d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || 'Gol';
      const minute = String(d.clock?.displayValue ?? '').replace(/['′]/g, '');
      return {
        name,
        minute: minute ? `${minute}'` : '',
        tag: d.penaltyKick ? 'pen' : d.ownGoal ? 'og' : '',
      };
    });
}

const isJuveEvent = (e: any) =>
  (e?.competitions?.[0]?.competitors ?? []).some((c: any) => String(c.team?.id) === JUVE_ID);

async function fetchTeamSchedule(): Promise<any[]> {
  try {
    const res = await fetch(`${ESPN_BASE}/site/v2/sports/soccer/ita.1/teams/${JUVE_ID}/schedule`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.events ?? [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const seasonEvents = await fetchSeasonEvents();

    // Sumber utama: scoreboard musim ini. Cadangan: endpoint jadwal tim.
    let source: 'scoreboard' | 'schedule' = 'scoreboard';
    let events = seasonEvents.filter(isJuveEvent);
    if (!events.length) {
      source = 'schedule';
      events = await fetchTeamSchedule();
    }

    if (!events.length) {
      return NextResponse.json(
        { error: 'ESPN tidak mengembalikan jadwal Juventus', upcoming: [], past: [] },
        { status: 502 }
      );
    }

    events.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const scoreboardById: Record<string, any> = {};
    seasonEvents.forEach((e) => (scoreboardById[String(e.id)] = e));

    const cutoff = seasonWindow().endDate.getTime();
    const upcoming: any[] = [];
    const past: any[] = [];

    events.forEach((event: any, index: number) => {
      const competition = event.competitions?.[0];
      if (!competition) return;

      const juve = competition.competitors.find((c: any) => String(c.team.id) === JUVE_ID);
      const opp = competition.competitors.find((c: any) => String(c.team.id) !== JUVE_ID);
      const date = new Date(event.date);
      const isHome = juve?.homeAway === 'home';
      const done = isCompleted(event);
      const juveScore = toNum(juve?.score);
      const oppScore = toNum(opp?.score);

      // Jadwal mendatang hanya sampai 31 Desember
      if (!done && date.getTime() > cutoff) return;

      const match = {
        id: String(event.id),
        week: index + 1,
        iso: date.toISOString(),
        ...fmtParts(date),
        opponentId: String(opp?.team?.id ?? ''),
        opponent: opp?.team?.displayName || 'TBA',
        opponentLogo: opp?.team?.logos?.[0]?.href || opp?.team?.logo || '',
        isHome,
        venueText: isHome ? 'KANDANG' : 'TANDANG',
        venue: competition.venue?.fullName || '',
        juveScore,
        opponentScore: oppScore,
        result: done ? (juveScore > oppScore ? 'W' : juveScore === oppScore ? 'D' : 'L') : null,
        scorers: done ? scorersOf(scoreboardById[String(event.id)] ?? event) : [],
      };

      (done ? past : upcoming).push(match);
    });

    past.reverse(); // hasil terbaru di atas
    return NextResponse.json({ upcoming, past, source });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan server', upcoming: [], past: [] }, { status: 500 });
  }
}
