import { NextResponse } from 'next/server';
import { fetchSalaries, REVALIDATE } from '@/lib/salaries-server';

// Halaman ini dibangun ulang paling cepat setiap 6 jam; selebihnya dilayani dari cache.
export const revalidate = 21600;

export async function GET() {
  const salaries = await fetchSalaries();
  if (!salaries) return NextResponse.json({ salaries: [], updatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } });
  return NextResponse.json(
    { salaries, updatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': `s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 4}` } }
  );
}
