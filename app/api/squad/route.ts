import { NextResponse } from 'next/server';
import { fetchFotmob, fetchTransfermarkt, withFotmobPhotos } from '@/lib/squad';
import type { SquadResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Skuad Juventus. Transfermarkt dulu (nilai pasar, kontrak, usia); kalau gagal/diblokir, FotMob.
 * Foto pemain selalu diutamakan dari FotMob (dicocokkan lewat nama); kalau FotMob gagal atau tak ada
 * kecocokan, foto Transfermarkt dipakai.
 * Tidak ada data karangan: field tanpa sumber bernilai null. Kalau dua-duanya gagal, balasannya
 * error 502 beserta alasan tiap sumber supaya mudah dilacak di log.
 */
export async function GET() {
  const errors: Record<string, string> = {};
  // Diminta bersamaan dengan Transfermarkt supaya tidak menambah waktu tunggu
  const fotmobPhotos = fetchFotmob().catch((e) => {
    errors.fotmobPhotos = String(e?.message ?? e);
    return null;
  });
  const sources = [
    ['transfermarkt', fetchTransfermarkt],
    ['fotmob', fetchFotmob],
  ] as const;

  for (const [source, load] of sources) {
    try {
      const loaded = await load();
      const { coach } = loaded;
      let { players } = loaded;
      if (source === 'transfermarkt') {
        const fm = await fotmobPhotos;
        if (fm) players = withFotmobPhotos(players, fm.players);
      }
      const body: SquadResponse = { players, coach, source, updatedAt: new Date().toISOString() };
      return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } });
    } catch (e: any) {
      errors[source] = String(e?.message ?? e);
      console.warn(`[squad] ${source} gagal:`, errors[source]);
    }
  }
  return NextResponse.json({ error: 'Skuad belum bisa dimuat dari Transfermarkt maupun FotMob', errors, players: [] }, { status: 502 });
}
