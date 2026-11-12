import { NextResponse } from 'next/server';
import { fetchPenguasaan } from '@/lib/penguasaan-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Penguasaan bola Juventus per laga, hasil menurut penguasaan, dan hubungannya dengan selisih xG. ?comp=<leagueId FotMob> */
export async function GET(req: Request) {
  try {
    const comp = new URL(req.url).searchParams.get('comp')?.replace(/[^\w-]/g, '') || 'all';
    const body = await fetchPenguasaan(comp);
    const hasData = body.matches.length > 0;
    return NextResponse.json(body, { headers: { 'Cache-Control': hasData ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
