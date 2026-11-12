import { NextResponse } from 'next/server';
import { fetchKiper } from '@/lib/kiper-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Analisa kiper Juventus: penyelamatan, clean sheet, gol dicegah dibanding xG (ESPN + xG FotMob opsional), semua kompetisi. */
export async function GET() {
  try {
    const body = await fetchKiper();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.matches ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
