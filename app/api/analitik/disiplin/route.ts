import { NextResponse } from 'next/server';
import { fetchDisiplin } from '@/lib/disiplin-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Disiplin Juventus: pelanggaran per laga, kartu, offside, serta pelanggar dan korban pelanggaran terbanyak per 90 menit. */
export async function GET() {
  try {
    const body = await fetchDisiplin();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.matches ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
