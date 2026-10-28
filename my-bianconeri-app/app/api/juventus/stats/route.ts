import { NextResponse } from 'next/server';
import { COMPETITIONS, JUVE_ID, aggregatePlayers } from '@/lib/espn';
import { loadJuve } from '@/lib/juve';

/** Statistik pemain Juventus (gol, penalti, kartu) dihitung dari kejadian tiap pertandingan. */
export async function GET(req: Request) {
  try {
    const requested = new URL(req.url).searchParams.get('league');
    const league = COMPETITIONS.some((c) => c.slug === requested) ? requested : null;
    const { juveEvents } = await loadJuve();
    const events = league ? juveEvents.filter((e) => e._league === league) : juveEvents;
    return NextResponse.json({ players: aggregatePlayers(events, JUVE_ID) });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server', players: [] }, { status: 500 });
  }
}
