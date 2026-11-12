import { NextResponse } from 'next/server';
import { fetchJadwal } from '@/lib/jadwal-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Kesulitan jadwal: xPts laga Serie A berikutnya tiap tim (model Poisson dari gol musim ini). */
export async function GET() {
  try {
    const body = await fetchJadwal();
    if (!body) return NextResponse.json({ error: 'Klasemen Serie A belum bisa dimuat dari ESPN' }, { status: 502 });
    return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
