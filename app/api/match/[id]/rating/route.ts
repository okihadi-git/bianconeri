import { NextResponse } from 'next/server';
import { COMPETITIONS } from '@/lib/espn';
import { fotmobMatch, juveSquadPool } from '@/lib/fotmob';
import { buildLiveMatch, fetchSummary } from '@/lib/live';
import { buildRatings } from '@/lib/ratings';

export const dynamic = 'force-dynamic';

/** Rating pemain (estimasi) satu laga: /api/match/{id}/rating?league=uefa.europa */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{5,12}$/.test(id)) return NextResponse.json({ error: 'ID pertandingan tidak valid' }, { status: 400 });
  const requested = new URL(req.url).searchParams.get('league') || '';
  const league = COMPETITIONS.some((c) => c.slug === requested) ? requested : 'all';

  try {
    const summary = await fetchSummary(league, id, false);
    if (!summary) return NextResponse.json({ error: 'Data laga belum tersedia' }, { status: 502 });

    // Ringkasan ESPN memuat header laga; bentuk ulang menjadi "event" supaya bisa dipakai buildLiveMatch.
    const comp = summary?.header?.competitions?.[0];
    if (!comp) return NextResponse.json({ error: 'Header laga tidak tersedia' }, { status: 502 });
    const event = { id, date: comp.date ?? summary?.header?.gameDate, _league: league === 'all' ? '' : league, competitions: [comp] };

    const match = buildLiveMatch(event, summary);
    if (!match.lineups.home?.starters.length && !match.lineups.away?.starters.length) {
      return NextResponse.json({ error: 'Susunan pemain belum tersedia untuk laga ini' }, { status: 404 });
    }
    const [fm, squad] = await Promise.all([fotmobMatch(match.iso), juveSquadPool()]);
    return NextResponse.json(buildRatings(summary, match, fm, squad), {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=1800' },
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
