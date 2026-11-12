import { NextResponse } from 'next/server';
import { fetchTaktik } from '@/lib/taktik-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Bedah Taktik Juventus: ringkasan taktik otomatis dari data FotMob musim ini. */
export async function GET() {
  try {
    const body = await fetchTaktik();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.ringkasan.length ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
