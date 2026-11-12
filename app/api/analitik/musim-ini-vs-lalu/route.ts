import { NextResponse } from 'next/server';
import { fetchMusim } from '@/lib/musim-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Serie A musim ini dibanding musim lalu pada jumlah laga yang sama: poin, menang, gol, kebobolan, clean sheet, selisih gol. */
export async function GET() {
  try {
    const body = await fetchMusim();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.now ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
