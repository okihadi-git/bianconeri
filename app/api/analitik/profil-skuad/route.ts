import { NextResponse } from 'next/server';
import { fetchSkuad } from '@/lib/skuad-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Profil skuad Juventus berbobot menit bermain: usia rata-rata, kelompok usia, lulusan akademi vs rekrutan, negara. */
export async function GET() {
  try {
    const body = await fetchSkuad();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.players ? 's-maxage=1800, stale-while-revalidate=7200' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
