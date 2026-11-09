import { NextResponse } from 'next/server';
import { fetchWomen } from '@/lib/women';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Klasemen + jadwal & hasil Juventus Women (ESPN). Selalu 200; kekosongan dijelaskan di `warnings` dan `sources`. */
export async function GET() {
  try {
    const body = await fetchWomen();
    const empty = !body.standings.length && !body.matches.length;
    return NextResponse.json(body, { headers: { 'Cache-Control': empty ? 'no-store' : 's-maxage=900, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
