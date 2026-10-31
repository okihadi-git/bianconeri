import { NextResponse } from 'next/server';
import { fetchNews } from '@/lib/news';

export const dynamic = 'force-dynamic';

/**
 * Berita Juventus dari RSS Google News (judul + sumber + waktu + tautan saja), diperbarui otomatis tiap ~20 menit.
 * Kategori dan label keandalan adalah perkiraan otomatis dari kata kunci dan daftar sumber (lib/news.ts).
 * Kalau semua umpan gagal, balasannya 502 beserta alasan tiap umpan supaya mudah dilacak di log.
 */
export async function GET() {
  try {
    const body = await fetchNews();
    return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=1200, stale-while-revalidate=3600' } });
  } catch (e: any) {
    console.warn('[berita] gagal:', e?.message, e?.errors);
    return NextResponse.json({ error: 'Berita belum bisa dimuat', errors: e?.errors ?? {}, items: [] }, { status: 502 });
  }
}
