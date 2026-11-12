import { NextResponse } from 'next/server';
import { COACH_SOURCES } from '@/lib/coach-config';
import { fetchCoaches } from '@/lib/coaches';

export const dynamic = 'force-dynamic';

/**
 * Riwayat pelatih kepala (Wikipedia: daftar pelatih + jumlah trofi + foto) dan staf pelatih (manual, lib/coach-config.ts).
 * ?club=juventus (default). Hasil di-cache 1 hari; kalau daftar gagal dimuat, tidak di-cache dan alasannya ada di `errors`.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('club') ?? 'juventus';
  const cfg = COACH_SOURCES[slug];
  if (!cfg) return NextResponse.json({ error: `Klub "${slug}" belum didaftarkan` }, { status: 404 });

  const body = await fetchCoaches(cfg);
  const cache = body.managers.length ? 's-maxage=86400, stale-while-revalidate=604800' : 'no-store';
  return NextResponse.json(body, { headers: { 'Cache-Control': cache } });
}
