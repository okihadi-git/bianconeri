import { NextResponse } from 'next/server';
import { fetchPenyelesaian } from '@/lib/penyelesaian-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Penyelesaian Juventus: peta tembakan + gol vs xG per pemain. ?comp=<leagueId FotMob> */
export async function GET(req: Request) {
  try {
    const comp = new URL(req.url).searchParams.get('comp')?.replace(/[^\w-]/g, '') || 'all';
    const body = await fetchPenyelesaian(comp);
    const hasData = body.players.length > 0;
    return NextResponse.json(body, { headers: { 'Cache-Control': hasData ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
