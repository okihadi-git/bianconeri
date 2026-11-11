import { NextResponse } from 'next/server';
import { fetchInjuries } from '@/lib/injuries';

export const maxDuration = 30;

/** Pemain Juventus yang cedera menurut FotMob. 502 bila skuad tidak bisa dimuat sama sekali. */
export async function GET() {
  try {
    const body = await fetchInjuries();
    if (body.checked === 0) return NextResponse.json({ error: 'Data cedera belum bisa dimuat dari FotMob' }, { status: 502 });
    return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'Data cedera belum bisa dimuat dari FotMob' }, { status: 502 });
  }
}
