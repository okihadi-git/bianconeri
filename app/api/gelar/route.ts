import { NextResponse } from 'next/server';
import { fetchGelar } from '@/lib/gelar-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Sisa jadwal, tingkat kesulitan, dan proyeksi untuk tab Perebutan gelar: /api/gelar?league=ita.1 */
export async function GET(req: Request) {
  const league = new URL(req.url).searchParams.get('league') || 'ita.1';
  try {
    const body = await fetchGelar(league);
    if (!body) return NextResponse.json({ error: 'Klasemen atau jadwal belum bisa dimuat dari ESPN' }, { status: 502 });
    return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
