import { NextResponse } from 'next/server';
import { COMPETITIONS } from '@/lib/espn';
import { loadJuve } from '@/lib/juve';

export async function GET(req: Request) {
  try {
    const requested = new URL(req.url).searchParams.get('league');
    const league = COMPETITIONS.some((c) => c.slug === requested) ? requested : null;

    const { upcoming, past, debug } = await loadJuve();
    if (!upcoming.length && !past.length) {
      return NextResponse.json(
        { error: 'ESPN tidak mengembalikan jadwal Juventus', upcoming: [], past: [], debug },
        { status: 502 }
      );
    }
    const pick = <T extends { league: string }>(list: T[]) => (league ? list.filter((m) => m.league === league) : list);
    return NextResponse.json({ upcoming: pick(upcoming).slice(0, 60), past: pick(past), debug });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server', upcoming: [], past: [] }, { status: 500 });
  }
}
