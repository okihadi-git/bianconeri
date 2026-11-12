import { NextResponse } from 'next/server';
import { fetchPengganti } from '@/lib/pengganti-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Pemain pengganti Juventus: waktu pergantian, dampak poin, gol+assist dari bangku. ?comp=<leagueId FotMob> */
export async function GET(req: Request) {
  try {
    const comp = new URL(req.url).searchParams.get('comp')?.replace(/[^\w-]/g, '') || 'all';
    const body = await fetchPengganti(comp);
    const hasData = body.totals.subs > 0;
    return NextResponse.json(body, { headers: { 'Cache-Control': hasData ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
