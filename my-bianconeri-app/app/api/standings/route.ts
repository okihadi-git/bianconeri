import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://site.api.espn.com/apis/v2/sports/soccer/ita.1/standings', {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Gagal memuat data dari ESPN' }, { status: res.status });
    }

    const data = await res.json();
    const entries = data?.children?.[0]?.standings?.entries || [];

    const standings = entries.map((entry: any) => {
      const stats = entry.stats || [];
      const getStat = (name: string) => stats.find((s: any) => s.name === name)?.value || 0;
      const getStatSummary = (name: string) => stats.find((s: any) => s.name === name)?.displayValue || '';

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
        // Ambil riwayat 5 laga (misal: "W,W,D,L,W")
        form: getStatSummary('form') || 'W,D,W,M,S',
      };
    });

    return NextResponse.json({ standings });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
