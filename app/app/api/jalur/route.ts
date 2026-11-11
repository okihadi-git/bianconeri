import { NextResponse } from 'next/server';
import { fetchHistory } from '@/lib/jalur-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Data musim-musim lalu untuk tab "Jalur ke Eropa" / "Jalan ke trofi": /api/jalur?league=ita.1 */
export async function GET(req: Request) {
  const league = new URL(req.url).searchParams.get('league') || 'ita.1';
  try {
    const history = await fetchHistory(league);
    return NextResponse.json({ league, history }, { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' } });
  } catch {
    return NextResponse.json({ league, history: [] }, { status: 200 });
  }
}
