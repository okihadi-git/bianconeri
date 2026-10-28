import { NextResponse } from 'next/server';
import { ESPN_BASE, buildFormMap, fetchSeasonEvents, isCompleted } from '@/lib/espn';

export async function GET() {
  try {
    const [res, events] = await Promise.all([
      fetch(`${ESPN_BASE}/v2/sports/soccer/ita.1/standings`, { next: { revalidate: 3600 } }),
      fetchSeasonEvents(),
    ]);

    if (!res.ok) {
      return NextResponse.json({ error: 'Gagal memuat data dari ESPN' }, { status: res.status });
    }

    const data = await res.json();
    const entries = data?.children?.[0]?.standings?.entries || [];
    const formMap = buildFormMap(events);

    const standings = entries
      .map((entry: any) => {
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
          // 5 laga terakhir, urut lama → terbaru
          form: (formMap[id] || []).slice(-5),
        };
      })
      .sort((a: any, b: any) => a.position - b.position);

    const lastDone = events
      .filter(isCompleted)
      .map((e: any) => new Date(e.date).getTime())
      .sort((a: number, b: number) => b - a)[0];

    const week = standings.reduce((max: number, t: any) => Math.max(max, t.playedGames), 0);

    return NextResponse.json({
      standings,
      week,
      updatedAt: lastDone ? new Date(lastDone).toISOString() : null,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
