import { NextResponse } from 'next/server';
import { ESPN_BASE, addDays, buildFormMap, fetchLeagueEvents, isCompleted, seasonStart } from '@/lib/espn';

const ALLOWED = ['ita.1', 'uefa.europa', 'uefa.champions'];

export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('league') || 'ita.1';
  const league = ALLOWED.includes(requested) ? requested : 'ita.1';

  try {
    const [res, events] = await Promise.all([
      fetch(`${ESPN_BASE}/v2/sports/soccer/${league}/standings`, { next: { revalidate: 3600 } }),
      fetchLeagueEvents(league, seasonStart(), addDays(new Date(), 7)),
    ]);

    if (!res.ok) {
      return NextResponse.json({ error: 'Gagal memuat data dari ESPN' }, { status: res.status });
    }

    const data = await res.json();
    const entries = data?.children?.[0]?.standings?.entries || [];
    const formMap = buildFormMap(events);

    const rows = entries.map((entry: any) => {
      const stats = entry.stats || [];
      const getStat = (name: string) => stats.find((s: any) => s.name === name)?.value ?? 0;
      const id = String(entry.team.id);
      return {
        id,
        name: entry.team.displayName,
        shortName: entry.team.abbreviation || entry.team.shortDisplayName,
        logo: entry.team.logos?.[0]?.href || '',
        position: getStat('rank'),
        playedGames: getStat('gamesPlayed'),
        won: getStat('wins'),
        draw: getStat('ties'),
        lost: getStat('losses'),
        goalsFor: getStat('pointsFor'),
        goalsAgainst: getStat('pointsAgainst'),
        goalDifference: getStat('pointDifferential'),
        points: getStat('points'),
        form: (formMap[id] || []).slice(-5),
      };
    });

    // Urutkan; kalau ESPN tidak memberi peringkat, urutkan manual (poin, selisih gol, gol)
    rows.sort(
      (a: any, b: any) =>
        (a.position || 999) - (b.position || 999) ||
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor
    );
    rows.forEach((r: any, i: number) => {
      if (!r.position) r.position = i + 1;
    });

    const lastDone = events
      .filter(isCompleted)
      .map((e: any) => new Date(e.date).getTime())
      .sort((a: number, b: number) => b - a)[0];

    return NextResponse.json({
      standings: rows,
      week: rows.reduce((max: number, t: any) => Math.max(max, t.playedGames), 0),
      updatedAt: lastDone ? new Date(lastDone).toISOString() : null,
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
