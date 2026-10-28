import { NextResponse } from 'next/server';
import { COMPETITIONS, ESPN_BASE, JUVE_ID } from '@/lib/espn';

/**
 * Detail satu pertandingan (data yang sama dengan halaman
 * espn.com/soccer/team-stats/_/gameId/<id>), diambil dari endpoint summary ESPN.
 */
const STAT_LABELS: [string, string][] = [
  ['possessionPct', 'Penguasaan bola'],
  ['totalShots', 'Tembakan'],
  ['shotsOnTarget', 'Tepat sasaran'],
  ['wonCorners', 'Tendangan sudut'],
  ['foulsCommitted', 'Pelanggaran'],
  ['yellowCards', 'Kartu kuning'],
  ['redCards', 'Kartu merah'],
  ['offsides', 'Offside'],
  ['saves', 'Penyelamatan'],
  ['totalPasses', 'Umpan'],
  ['passPct', 'Akurasi umpan'],
  ['effectiveTackles', 'Tekel sukses'],
  ['interceptions', 'Intersep'],
];

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{5,12}$/.test(id)) {
    return NextResponse.json({ error: 'ID pertandingan tidak valid' }, { status: 400 });
  }

  const requested = new URL(req.url).searchParams.get('league') || '';
  const league = COMPETITIONS.some((c) => c.slug === requested) ? requested : 'all';

  try {
    const urls = [`${ESPN_BASE}/site/v2/sports/soccer/${league}/summary?event=${id}`];
    if (league !== 'all') urls.push(`${ESPN_BASE}/site/v2/sports/soccer/all/summary?event=${id}`);

    let data: any = null;
    for (const url of urls) {
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (res.ok) {
        data = await res.json();
        if (data?.boxscore) break;
      }
    }
    if (!data) return NextResponse.json({ error: 'Detail pertandingan tidak tersedia' }, { status: 502 });

    const teams: any[] = data?.boxscore?.teams ?? [];
    const juve = teams.find((t) => String(t.team?.id) === JUVE_ID);
    const opp = teams.find((t) => String(t.team?.id) !== JUVE_ID);
    const get = (t: any, name: string) => t?.statistics?.find((s: any) => s.name === name)?.displayValue;

    const stats = STAT_LABELS.map(([name, label]) => ({
      key: name,
      label,
      juve: get(juve, name),
      opp: get(opp, name),
    })).filter((s) => s.juve !== undefined && s.opp !== undefined);

    return NextResponse.json({
      stats,
      opponent: opp?.team?.displayName ?? '',
      venue: data?.gameInfo?.venue?.fullName ?? '',
      attendance: data?.gameInfo?.attendance ?? null,
      referee: data?.gameInfo?.officials?.[0]?.displayName ?? '',
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
