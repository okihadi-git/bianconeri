import { NextResponse } from 'next/server';
import { fetchAkademi } from '@/lib/akademi';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Akademi Juventus (Next Gen dan pinjaman) dari FotMob. Selalu 200; kekosongan dijelaskan di `warnings` dan `sources`. */
export async function GET() {
  try {
    const body = await fetchAkademi();
    const empty = !body.nextgen;
    return NextResponse.json(body, { headers: { 'Cache-Control': empty ? 'no-store' : 's-maxage=900, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
