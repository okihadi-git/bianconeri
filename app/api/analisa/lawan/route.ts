import { NextResponse } from 'next/server';
import { fetchLawan } from '@/lib/lawan-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Analisa lawan berikutnya Juventus: prediksi skor, perbandingan musim ini, hasil terakhir lawan, cuaca. */
export async function GET() {
  try {
    const body = await fetchLawan();
    if (!body) return NextResponse.json({ error: 'Jadwal Juventus belum bisa dimuat dari ESPN' }, { status: 502 });
    return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
