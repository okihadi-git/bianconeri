import { NextResponse } from 'next/server';
import { debugHeatmap, fetchHeatmap } from '@/lib/heatmap';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

/**
 * Heatmap gabungan laga-laga terakhir satu pemain: /api/player/heatmap?name=Bremer
 * Tambahkan &debug=1 untuk melihat bentuk respons FotMob (jumlah titik per kunci) bila heatmap tidak muncul.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const name = sp.get('name')?.trim();
  if (!name || name.length > 80) return NextResponse.json({ error: 'Parameter name wajib diisi' }, { status: 400 });
  try {
    if (sp.get('debug')) return NextResponse.json(await debugHeatmap(name));
    const body = await fetchHeatmap(name);
    if (!body) return NextResponse.json({ error: 'Heatmap belum tersedia dari FotMob' }, { status: 404 });
    return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=21600' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
