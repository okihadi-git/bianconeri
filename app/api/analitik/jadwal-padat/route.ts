import { NextResponse } from 'next/server';
import { fetchPadat } from '@/lib/padat-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Jadwal padat Juventus: poin per laga dan selisih xG menurut hari istirahat, plus sebaran jeda vs selisih xG per laga. */
export async function GET() {
  try {
    const body = await fetchPadat();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.total ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
