import { NextResponse } from 'next/server';
import { fetchPeluang } from '@/lib/peluang-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Peluang juara, top 4, dan degradasi dari simulasi sisa musim: /api/peluang?league=ita.1 */
export async function GET(req: Request) {
  const league = new URL(req.url).searchParams.get('league') || 'ita.1';
  try {
    const body = await fetchPeluang(league);
    if (!body) return NextResponse.json({ error: 'Klasemen belum bisa dimuat dari ESPN' }, { status: 502 });
    return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
