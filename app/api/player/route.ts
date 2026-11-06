import { NextResponse } from 'next/server';
import { fetchPlayerDetail } from '@/lib/player';

export const maxDuration = 30;

/**
 * Detail satu pemain Juventus untuk popup di halaman Skuad: /api/player?name=Bremer
 * Gagal (FotMob memblokir / pemain tidak ditemukan) = 502; popup tetap tampil dengan data skuad saja.
 */
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get('name')?.trim();
  if (!name || name.length > 80) return NextResponse.json({ error: 'Parameter name wajib diisi' }, { status: 400 });
  try {
    const detail = await fetchPlayerDetail(name);
    if (!detail) return NextResponse.json({ error: 'Detail pemain belum bisa dimuat dari FotMob' }, { status: 502 });
    return NextResponse.json(detail, { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
