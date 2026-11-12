import { NextResponse } from 'next/server';
import { fetchRekor } from '@/lib/rekor-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Rekor beruntun Juventus musim ini (tak terkalahkan, menang, clean sheet, dst.) dan progres menuju 33 kemenangan Serie A. */
export async function GET() {
  try {
    const body = await fetchRekor();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.total ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
