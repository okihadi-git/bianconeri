import { NextResponse } from 'next/server';
import { fetchFormasi } from '@/lib/bedah-taktik/formasi-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Bedah Taktik → Formasi & XI: formasi yang dipakai dan XI paling sering (lineup ESPN laga selesai). */
export async function GET() {
  try {
    const body = await fetchFormasi();
    return NextResponse.json(body, { headers: { 'Cache-Control': body.matches ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
