import { NextResponse } from 'next/server';
import { fetchKreator } from '@/lib/kreator-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Peluang diciptakan Juventus: 10 kreator teratas (umpan kunci, xA, assist), komposisi situasi, gaji. ?comp=<leagueId FotMob> */
export async function GET(req: Request) {
  try {
    const comp = new URL(req.url).searchParams.get('comp')?.replace(/[^\w-]/g, '') || 'all';
    const body = await fetchKreator(comp);
    const hasData = body.top.length > 0;
    return NextResponse.json(body, { headers: { 'Cache-Control': hasData ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
