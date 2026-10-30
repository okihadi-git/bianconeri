import { NextResponse } from 'next/server';
import { loadJuve } from '@/lib/juve';
import { buildPlayerStats } from '@/lib/playerstats';

export const maxDuration = 30;

/** Statistik pemain Juventus untuk semua kompetisi; penyaringan per kompetisi dilakukan di sisi klien. */
export async function GET() {
  try {
    const { juveEvents } = await loadJuve();
    const body = await buildPlayerStats(juveEvents);
    return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server', players: [], matches: {} }, { status: 500 });
  }
}
