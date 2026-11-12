import { NextResponse } from 'next/server';
import { COMPETITIONS, JUVE_ID, addDays, aggregatePlayers, fetchLeagueEvents, isCompleted, seasonStart, toNum } from '@/lib/espn';
import { fmtParts, monthLabel } from '@/lib/juve';

/** Semua pertandingan satu kompetisi + top skor seluruh kompetisi. */
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('league') || '';
  if (!COMPETITIONS.some((c) => c.slug === requested)) {
    return NextResponse.json({ error: 'Kompetisi tidak dikenal' }, { status: 400 });
  }

  try {
    const events = await fetchLeagueEvents(requested, seasonStart(), addDays(new Date(), 150));
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const matches = events.map((e) => {
      const comp = e.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home') ?? comp?.competitors?.[0];
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away') ?? comp?.competitors?.[1];
      const state = comp?.status?.type?.state ?? e.status?.type?.state;
      const status = isCompleted(e) ? 'post' : state === 'in' ? 'live' : 'pre';
      const side = (c: any) => ({
        id: String(c?.team?.id ?? ''),
        name: c?.team?.displayName ?? 'TBA',
        abbr: c?.team?.abbreviation ?? '',
        logo: c?.team?.logos?.[0]?.href || c?.team?.logo || '',
        score: status === 'pre' ? null : toNum(c?.score),
      });
      const date = new Date(e.date);
      return {
        id: String(e.id),
        iso: date.toISOString(),
        month: monthLabel(date),
        ...fmtParts(date),
        round: comp?.notes?.[0]?.headline || '',
        status,
        home: side(home),
        away: side(away),
        involvesJuve: String(home?.team?.id) === JUVE_ID || String(away?.team?.id) === JUVE_ID,
      };
    });

    return NextResponse.json({ matches, topScorers: aggregatePlayers(events).slice(0, 30) });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server', matches: [], topScorers: [] }, { status: 500 });
  }
}
