import { NextResponse } from 'next/server';
import { FOTMOB_YOUTH_ID, primaveraLeagueOnly } from '@/lib/akademi';
import { fetchScorers } from '@/lib/akademi-stats';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Pencetak gol Juventus Youth (U20) di Campionato Primavera 1 musim ini, dihitung dari kejadian gol tiap laga FotMob. */
export async function GET() {
  try {
    const body = await fetchScorers(FOTMOB_YOUTH_ID, primaveraLeagueOnly);
    if (!body) return NextResponse.json({ error: 'Data Juventus Youth belum bisa dimuat dari FotMob' }, { status: 502 });
    return NextResponse.json(body, { headers: { 'Cache-Control': body.rows.length ? 's-maxage=1800, stale-while-revalidate=7200' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
