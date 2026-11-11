import { NextResponse } from 'next/server';
import {
  ESPN_BASE,
  addDays,
  buildFormMap,
  fetchLeagueEvents,
  isCompleted,
  seasonStart,
} from '@/lib/espn';

const ALLOWED = ['ita.1', 'uefa.europa', 'uefa.champions'];

export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('league') || 'ita.1';
  const league = ALLOWED.includes(requested) ? requested : 'ita.1';

  try {
    const [res, events] = await Promise.all([
      fetch(`${ESPN_BASE}/v2/sports/soccer/${league}/standings`, {
        next: { revalidate: 3600 },
      }),
      // Fetch the season in bounded monthly chunks so older completed games
      // are not lost when ESPN returns only part of a long scoreboard range.
      fetchLeagueEvents(league, seasonStart(), addDays(new Date(), 7)),
    ]);

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Gagal memuat data klasemen dari ESPN', league },
        { status: res.status }
      );
    }

    const data = await res.json();
    const entries =
      data?.children?.flatMap((group: any) => group?.standings?.entries ?? []) ??
      data?.standings?.entries ??
      [];
    const formMap = buildFormMap(events);

    const rows = entries.map((entry: any) => {
      const stats = entry.stats || [];
      const getStat = (name: string) =>
        stats.find((s: any) => s.name === name)?.value ?? 0;
      const id = String(entry.team?.id ?? '');

      return {
        id,
        name: entry.team?.displayName ?? entry.team?.name ?? 'Tim',
        shortName: entry.team?.abbreviation || entry.team?.shortDisplayName || '',
        logo: entry.team?.logos?.[0]?.href || '',
        position: getStat('rank'),
        playedGames: getStat('gamesPlayed'),
        won: getStat('wins'),
        draw: getStat('ties'),
        lost: getStat('losses'),
        goalsFor: getStat('pointsFor'),
        goalsAgainst: getStat('pointsAgainst'),
        goalDifference: getStat('pointDifferential'),
        points: getStat('points'),
        // Keep the most recent five completed results, oldest -> newest.
        form: (formMap[id] || []).slice(-5),
      };
    });

    rows.sort(
      (a: any, b: any) =>
        (a.position || 999) - (b.position || 999) ||
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor
    );

    rows.forEach((row: any, index: number) => {
      if (!row.position) row.position = index + 1;
    });

    const completedEvents = events.filter(isCompleted);
    const lastDone = completedEvents
      .map((event: any) => new Date(event.date).getTime())
      .filter((time: number) => Number.isFinite(time))
      .sort((a: number, b: number) => b - a)[0];

    return NextResponse.json(
      {
        standings: rows,
        week: rows.reduce(
          (max: number, team: any) => Math.max(max, Number(team.playedGames) || 0),
          0
        ),
        updatedAt: lastDone ? new Date(lastDone).toISOString() : null,
        // Useful for diagnostics; does not affect the table UI.
        formData: {
          completedMatchesFetched: completedEvents.length,
          teamsWithForm: Object.values(formMap).filter(
            (form) => Array.isArray(form) && form.length > 0
          ).length,
        },
      },
      { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } }
    );
  } catch (error) {
    console.error(`[standings:${league}]`, error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil klasemen atau hasil pertandingan ESPN', league },
      { status: 500 }
    );
  }
}
