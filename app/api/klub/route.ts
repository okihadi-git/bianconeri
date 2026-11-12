import { NextResponse } from 'next/server';
import { CLUBS } from '@/lib/clubs';
import { fetchKlub } from '@/lib/wiki';

export const dynamic = 'force-dynamic';

/**
 * Halaman Klub: narasi sejarah dari Wikipedia (id, cadangan en), kartu ringkas dari Wikidata,
 * kronologi dari lib/clubs.ts. ?club=juventus (default). Tanpa database; hasil di-cache 1 hari.
 * Kalau satu sumber gagal, bagian itu kosong dan alasannya ada di `errors` — tidak ada data karangan.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('club') ?? 'juventus';
  const cfg = CLUBS[slug];
  if (!cfg) return NextResponse.json({ error: `Klub "${slug}" belum didaftarkan` }, { status: 404 });

  const body = await fetchKlub(cfg);
  // Jangan men-cache hasil yang narasinya gagal dimuat, supaya percobaan berikutnya bisa pulih
  const cache = body.eras.length ? 's-maxage=86400, stale-while-revalidate=604800' : 'no-store';
  return NextResponse.json(body, { headers: { 'Cache-Control': cache } });
}
