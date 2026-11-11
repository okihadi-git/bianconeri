import { NextResponse } from 'next/server';
import { fetchLaju } from '@/lib/laju-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

/** Poin kumulatif per laga untuk tab Laju poin: /api/laju?league=ita.1 */
export async function GET(req: Request) {
  const league = new URL(req.url).searchParams.get('league') || 'ita.1';
  try {
    const body = await fetchLaju(league);
    if (!body) return NextResponse.json({ error: 'Klasemen atau hasil laga belum bisa dimuat dari ESPN' }, { status: 502 });
    return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
