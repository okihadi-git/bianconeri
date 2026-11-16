import { NextResponse } from 'next/server';
import { eventState } from '@/lib/core/espn';
import { attachPhotos } from '@/lib/core/fotmob';
import { buildLiveMatch, fetchRecentJuveEvents, fetchSummary, pickLiveEvent } from '@/lib/core/live';
import type { LiveResponse } from '@/lib/core/types';

export const dynamic = 'force-dynamic';

/**
 * Skor live Juventus. Mengembalikan laga yang sedang berjalan, atau laga yang baru selesai
 * (lihat RECENT_HOURS di lib/live.ts) lengkap dengan timeline, susunan pemain, dan statistik.
 * `match: null` berarti tidak ada laga yang perlu ditampilkan.
 */
export async function GET() {
  try {
    const events = await fetchRecentJuveEvents();
    const event = pickLiveEvent(events);
    const updatedAt = new Date().toISOString();

    if (!event) return NextResponse.json({ match: null, updatedAt } satisfies LiveResponse);

    const summary = await fetchSummary(String(event._league ?? 'all'), String(event.id), eventState(event) === 'live');
    const match = await attachPhotos(buildLiveMatch(event, summary));
    return NextResponse.json({ match, updatedAt } satisfies LiveResponse);
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server', match: null }, { status: 500 });
  }
}
