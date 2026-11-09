import { NextResponse } from 'next/server';
import { fetchTimnas } from '@/lib/timnas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Pemain Juventus di laga timnas selama jeda internasional: /api/timnas?jeda=sep-okt-2026 */
export async function GET(req: Request) {
  try {
    const body = await fetchTimnas(new URL(req.url).searchParams.get('jeda'));
    if (!body) return NextResponse.json({ error: 'Skuad Juventus belum bisa dimuat, jadi pemain timnas tidak bisa dicocokkan.' }, { status: 502 });
    const maxAge = body.state === 'berlangsung' ? 300 : 900;
    return NextResponse.json(body, { headers: { 'Cache-Control': `s-maxage=${maxAge}, stale-while-revalidate=3600` } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
