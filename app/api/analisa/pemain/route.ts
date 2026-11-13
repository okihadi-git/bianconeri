import { NextResponse } from 'next/server';
import { fetchPemain } from '@/lib/pemain-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Analisa pemain Juventus: dampak starter vs tidak, duet assist→gol, dan tonggak karier (ESPN + Wikipedia). */
export async function GET() {
  try {
    const body = await fetchPemain();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.matches ? 's-maxage=900, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
