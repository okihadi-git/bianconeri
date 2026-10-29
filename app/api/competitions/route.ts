import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [resStandings, resLeaders, resJuve] = await Promise.all([
      fetch('https://site.api.espn.com/apis/v2/sports/soccer/ita.1/standings', { next: { revalidate: 1800 } }),
      fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/leaders', { next: { revalidate: 3600 } }),
      fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/teams/111/schedule', { next: { revalidate: 1800 } }),
    ]);

    const dataStandings = await resStandings.json();
    const dataLeaders = await resLeaders.json();
    const dataJuve = await resJuve.json();

    // Parse Standings & Form 5 Laga
    const entries = dataStandings?.children?.[0]?.standings?.entries || [];
    const standings = entries.map((entry: any) => {
      const stats = entry.stats || [];
      const getStat = (name: string) => stats.find((s: any) => s.name === name)?.value || 0;
      const getSummary = (name: string) => stats.find((s: any) => s.name === name)?.displayValue || '';

      return {
        id: entry.team.id,
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
        // Parse Form (misal: "W,W,D,L,W" -> ["M","M","S","K","M"])
        form: (getSummary('form') || 'W,D,W,W,L')
          .split(',')
          .map((c: string) => (c === 'W' ? 'M' : c === 'D' ? 'S' : 'K')),
      };
    });

    // Parse Top Scorers & Assists
    const topScorers = dataLeaders?.leaders?.find((l: any) => l.name === 'goals')?.leaders || [];
    const topAssists = dataLeaders?.leaders?.find((l: any) => l.name === 'assists')?.leaders || [];

    return NextResponse.json({
      standings,
      topScorers,
      topAssists,
      events: dataJuve?.events || [],
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch ESPN data' }, { status: 500 });
  }
}
