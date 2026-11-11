import { NextResponse } from 'next/server';
import { FOTMOB_NEXTGEN_ID } from '@/lib/akademi';
import { fetchPerformance } from '@/lib/akademi-stats';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Performa pemain Next Gen musim ini (jumlah dari semua laga selesai di FotMob). 502 bila tim tidak bisa dimuat. */
export async function GET() {
  try {
    const body = await fetchPerformance(FOTMOB_NEXTGEN_ID);
    if (!body) return NextResponse.json({ error: 'Data Next Gen belum bisa dimuat dari FotMob' }, { status: 502 });
    return NextResponse.json(body, { headers: { 'Cache-Control': body.rows.length ? 's-maxage=1800, stale-while-revalidate=7200' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
