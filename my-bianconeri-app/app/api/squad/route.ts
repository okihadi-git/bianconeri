import { NextResponse } from 'next/server';
import { ESPN_BASE, JUVE_ID } from '@/lib/espn';

const GROUPS: Record<string, string> = { G: 'Kiper', D: 'Bek', M: 'Gelandang', F: 'Penyerang' };

export async function GET() {
  try {
    const res = await fetch(`${ESPN_BASE}/site/v2/sports/soccer/ita.1/teams/${JUVE_ID}/roster`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return NextResponse.json({ error: 'Skuad tidak tersedia', players: [] }, { status: res.status });

    const data = await res.json();
    // ESPN bisa mengirim daftar datar atau terkelompok ({ items: [...] })
    const raw: any[] = (data?.athletes ?? []).flatMap((a: any) => (Array.isArray(a?.items) ? a.items : [a]));

    const players = raw.map((a) => {
      const abbr = String(a.position?.abbreviation ?? '').toUpperCase();
      const first = abbr.charAt(0);
      return {
        id: String(a.id),
        name: a.displayName || a.fullName || '',
        jersey: a.jersey ?? '',
        position: a.position?.displayName || a.position?.name || '',
        group: GROUPS[first] ?? 'Lainnya',
        age: typeof a.age === 'number' ? a.age : null,
        nation: a.citizenship || a.birthPlace?.country || '',
        height: a.displayHeight || '',
        photo: a.headshot?.href || '',
      };
    });

    const c = Array.isArray(data?.coach) ? data.coach[0] : null;
    const coach = c ? [c.firstName, c.lastName].filter(Boolean).join(' ') : '';
    return NextResponse.json({ players, coach });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server', players: [] }, { status: 500 });
  }
}
