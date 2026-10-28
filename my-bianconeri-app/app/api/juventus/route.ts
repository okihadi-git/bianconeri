import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // ID Tim Juventus di ESPN adalah 111
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/teams/111/schedule',
      { next: { revalidate: 1800 } } // refresh tiap 30 menit
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Gagal mengambil jadwal Juventus' }, { status: res.status });
    }

    const data = await res.json();
    const events = data?.events || [];

    const upcoming: any[] = [];
    const past: any[] = [];

    events.forEach((event: any) => {
      const competition = event.competitions?.[0];
      if (!competition) return;

      const date = new Date(event.date);
      const formattedDate = date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
      });
      const formattedDay = date.toLocaleDateString('id-ID', { weekday: 'short' });
      const formattedTime = date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB';

      const juveCompetitor = competition.competitors.find((c: any) => c.team.id === '111');
      const opponentCompetitor = competition.competitors.find((c: any) => c.team.id !== '111');

      const isHome = juveCompetitor?.homeAway === 'home';
      const isCompleted = competition.status?.type?.completed;

      const matchInfo = {
        id: event.id,
        date: formattedDate,
        dayTime: `${formattedDay} · ${formattedTime}`,
        opponent: opponentCompetitor?.team?.displayName || 'TBA',
        opponentLogo: opponentCompetitor?.team?.logos?.[0]?.href || '',
        isHome,
        venueText: isHome ? 'KANDANG' : 'TANDANG',
        juveScore: juveCompetitor?.score?.value ?? '-',
        opponentScore: opponentCompetitor?.score?.value ?? '-',
        winner: juveCompetitor?.winner,
      };

      if (isCompleted) {
        past.push(matchInfo);
      } else {
        upcoming.push(matchInfo);
      }
    });

    return NextResponse.json({ upcoming, past });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
