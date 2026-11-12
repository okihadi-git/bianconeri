import { NextResponse } from 'next/server';
import { fetchKondisiLaga } from '@/lib/kondisilaga-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Kondisi laga Juventus: kandang/tandang, kualitas lawan, jam kick-off WIB, kompetisi (gabungan semua kompetisi resmi). */
export async function GET() {
  try {
    const body = await fetchKondisiLaga();
    const hasData = body.matches > 0;
    return NextResponse.json(body, { headers: { 'Cache-Control': hasData ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
