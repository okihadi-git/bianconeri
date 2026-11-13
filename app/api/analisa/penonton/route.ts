import { NextResponse } from 'next/server';
import { fetchPenonton } from '@/lib/penonton-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Penonton tiap laga resmi Juventus sejak awal musim (ESPN): rata-rata kandang/tandang, terbanyak, total. */
export async function GET() {
  try {
    const body = await fetchPenonton();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.rows.length ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
