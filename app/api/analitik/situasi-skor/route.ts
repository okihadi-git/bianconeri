import { NextResponse } from 'next/server';
import { fetchSituasiSkor } from '@/lib/situasiskor-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Situasi skor Juventus: waktu unggul/imbang/tertinggal, gol per 15 menit, alur skor tiap laga. ?comp=<leagueId FotMob> */
export async function GET(req: Request) {
  try {
    const comp = new URL(req.url).searchParams.get('comp')?.replace(/[^\w-]/g, '') || 'all';
    const body = await fetchSituasiSkor(comp);
    const hasData = body.matches.length > 0;
    return NextResponse.json(body, { headers: { 'Cache-Control': hasData ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
