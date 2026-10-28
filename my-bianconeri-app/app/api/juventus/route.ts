import { NextResponse } from 'next/server';
import { ESPN_BASE, JUVE_ID, fetchSeasonEvents, isCompleted, toNum } from '@/lib/espn';

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

export async function GET() {
  try {
    const [res, seasonEvents] = await Promise.all([
      fetch(`${ESPN_BASE}/site/v2/sports/soccer/ita.1/teams/${JUVE_ID}/schedule`, {
        next: { revalidate: 1800 },
      }),
      fetchSeasonEvents(),
    ]);

    if (!res.ok) {
      return NextResponse.json({ error: 'Gagal mengambil jadwal Juventus' }, { status: res.status });
    }

    const data = await res.json();
    const events: any[] = (data?.events || [])
      .filter((e: any) => (e.league?.slug ?? 'ita.1') === 'ita.1')
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const scoreboardById: Record<string, any> = {};
    seasonEvents.forEach((e) => (scoreboardById[String(e.id)] = e));

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
        scorers: done ? scorersOf(scoreboardById[String(event.id)]) : [],
      };

      (done ? past : upcoming).push(match);
    });

    past.reverse(); // hasil terbaru di atas
    return NextResponse.json({ upcoming, past });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
