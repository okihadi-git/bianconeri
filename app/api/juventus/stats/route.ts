import { NextResponse } from 'next/server';
import { loadJuve } from '@/lib/juve';
import { buildPlayerStats } from '@/lib/playerstats';
import { findPlayer, juveSquadPool } from '@/lib/fotmob';

export const maxDuration = 30;

/** Statistik pemain Juventus untuk semua kompetisi; penyaringan per kompetisi dilakukan di sisi klien. */
export async function GET() {
  try {
    const { juveEvents } = await loadJuve();
    const body = await buildPlayerStats(juveEvents);
    const pool = await juveSquadPool();
    for (const p of body.players) p.photo = findPlayer(p.name, pool)?.photo ?? '';
    return NextResponse.json(body, { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server', players: [], matches: {} }, { status: 500 });
  }
}
