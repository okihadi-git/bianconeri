import { NextResponse } from 'next/server';
import { fetchSalariesDetailed, REVALIDATE } from '@/lib/salaries-server';

// Dinamis supaya hasil kosong/gagal tidak ikut dibekukan; cache CDN diatur lewat header di bawah.
export const dynamic = 'force-dynamic';

export async function GET() {
  const { salaries, reason } = await fetchSalariesDetailed();
  const updatedAt = new Date().toISOString();

  if (!salaries.length) {
    // Gagal/kosong: cache pendek supaya begitu env/tabel diperbaiki, hasilnya cepat muncul. `reason` aman (tanpa kunci).
    return NextResponse.json({ salaries: [], updatedAt, reason }, { headers: { 'Cache-Control': 'no-store' } });
  }
  // Ada data: CDN menyimpan 6 jam, lalu menyajikan salinan lama sambil memperbarui di latar belakang.
  return NextResponse.json({ salaries, updatedAt }, { headers: { 'Cache-Control': `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 4}` } });
}
