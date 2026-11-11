import { NextResponse } from 'next/server';
import { fetchLagaDetail, fetchLagaList } from '@/lib/pusatlaga-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Pusat laga.
 *   /api/laga                       → daftar laga Juventus yang sudah selesai
 *   /api/laga?id=123&league=ita.1   → analisis satu laga (tembakan, xG, momentum, peluang menang)
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const id = sp.get('id');
  try {
    if (!id) {
      const matches = await fetchLagaList();
      if (!matches) return NextResponse.json({ error: 'Daftar laga belum bisa dimuat' }, { status: 502 });
      return NextResponse.json({ matches }, { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' } });
    }
    if (!/^\d{5,12}$/.test(id)) return NextResponse.json({ error: 'ID laga tidak valid' }, { status: 400 });
    const league = sp.get('league') || 'all';
    if (!/^[a-z0-9._-]{2,40}$/i.test(league)) return NextResponse.json({ error: 'Kompetisi tidak valid' }, { status: 400 });
    const detail = await fetchLagaDetail(id, league);
    if (!detail) return NextResponse.json({ error: 'Data laga belum tersedia dari ESPN' }, { status: 404 });
    return NextResponse.json(detail, { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
