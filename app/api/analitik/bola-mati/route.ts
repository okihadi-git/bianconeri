import { NextResponse } from 'next/server';
import { fetchBolaMati } from '@/lib/bolamati-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Bola mati Juventus: jenis gol dicetak/kebobolan, penalti, xG bola mati. ?comp=<leagueId FotMob> */
export async function GET(req: Request) {
  try {
    const comp = new URL(req.url).searchParams.get('comp')?.replace(/[^\w-]/g, '') || 'all';
    const body = await fetchBolaMati(comp);
    const hasData = body.totals.matches > 0;
    return NextResponse.json(body, { headers: { 'Cache-Control': hasData ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
