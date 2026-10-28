import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://site.api.espn.com/apis/v2/sports/soccer/ita.1/standings', {
      next: { revalidate: 3600 }, // Auto refresh data tiap 1 jam
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Gagal memuat data dari ESPN API' }, { status: res.status });
    }

    const data = await res.json();
    
    // Formatting data ESPN agar mudah dibaca oleh komponen frontend
    const entries = data?.children?.[0]?.standings?.entries || [];
    
    const standings = entries.map((entry: any) => {
      const stats = entry.stats || [];
      const getStat = (name: string) => stats.find((s: any) => s.name === name)?.value || 0;

      return {
        id: entry.team.id,
        name: entry.team.displayName,
        shortName: entry.team.shortDisplayName || entry.team.abbreviation,
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
      };
    });

    return NextResponse.json({ standings });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
