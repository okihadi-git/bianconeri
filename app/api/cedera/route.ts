import { NextResponse } from 'next/server';
import { fetchInjuries } from '@/lib/injuries';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

/** Pemain cedera di skuad Juventus (FotMob playerData). 502 bila FotMob tidak bisa dihubungi sama sekali. */
export async function GET() {
  try {
    const body = await fetchInjuries();
    if (!body) return NextResponse.json({ error: 'Data cedera belum bisa dimuat dari FotMob' }, { status: 502 });
    return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
