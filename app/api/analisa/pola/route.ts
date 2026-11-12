import { NextResponse } from 'next/server';
import { fetchPola } from '@/lib/pola-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Pola laga Juventus: menit gol, situasi skor, kandang/tandang, dan level lawan (ESPN) + xG per laga (FotMob, opsional). */
export async function GET() {
  try {
    const body = await fetchPola();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.games.length ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
