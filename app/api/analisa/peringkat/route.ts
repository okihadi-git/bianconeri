import { NextResponse } from 'next/server';
import { debugPeringkat, fetchPeringkat } from '@/lib/peringkat-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Peringkat klub berdasarkan koefisien UEFA 5 musim: 10 besar + Juventus. `?debug=1` menampilkan respons mentah tiap sumber. */
export async function GET(req: Request) {
  try {
    if (new URL(req.url).searchParams.get('debug') === '1') return NextResponse.json(await debugPeringkat(), { headers: { 'Cache-Control': 'no-store' } });
    const body = await fetchPeringkat();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.top.length ? 's-maxage=1800, stale-while-revalidate=21600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
