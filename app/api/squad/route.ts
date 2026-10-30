import { NextResponse } from 'next/server';
import { fetchFotmob, fetchTransfermarkt } from '@/lib/squad';
import type { SquadResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Skuad Juventus. Transfermarkt dulu (nilai pasar, kontrak, usia); kalau gagal/diblokir, FotMob.
 * Tidak ada data karangan: field tanpa sumber bernilai null. Kalau dua-duanya gagal, balasannya
 * error 502 beserta alasan tiap sumber supaya mudah dilacak di log.
 */
export async function GET() {
  const errors: Record<string, string> = {};
  const sources = [
    ['transfermarkt', fetchTransfermarkt],
    ['fotmob', fetchFotmob],
  ] as const;

  for (const [source, load] of sources) {
    try {
      const { players, coach } = await load();
      const body: SquadResponse = { players, coach, source, updatedAt: new Date().toISOString() };
      return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } });
    } catch (e: any) {
      errors[source] = String(e?.message ?? e);
      console.warn(`[squad] ${source} gagal:`, errors[source]);
    }
  }
  return NextResponse.json({ error: 'Skuad belum bisa dimuat dari Transfermarkt maupun FotMob', errors, players: [] }, { status: 502 });
}
