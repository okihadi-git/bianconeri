import { NextResponse } from 'next/server';
import { COMPETITIONS, ESPN_BASE, JUVE_ID } from '@/lib/espn';

const STAT_LABELS: [string, string][] = [
  ['possessionPct', 'Penguasaan bola'], ['totalShots', 'Tembakan'], ['shotsOnTarget', 'Tepat sasaran'],
  ['wonCorners', 'Tendangan sudut'], ['foulsCommitted', 'Pelanggaran'], ['yellowCards', 'Kartu kuning'],
  ['redCards', 'Kartu merah'], ['offsides', 'Offside'], ['saves', 'Penyelamatan'],
  ['totalPasses', 'Umpan'], ['passPct', 'Akurasi umpan'], ['effectiveTackles', 'Tekel sukses'],
  ['interceptions', 'Intersep'],
];
const str = (v: any) => String(v ?? '').trim();

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{5,12}$/.test(id)) return NextResponse.json({ error: 'ID pertandingan tidak valid' }, { status: 400 });
  const requested = new URL(req.url).searchParams.get('league') || '';
  const league = COMPETITIONS.some((c) => c.slug === requested) ? requested : 'all';
  try {
    const urls = [`${ESPN_BASE}/site/v2/sports/soccer/${league}/summary?event=${id}`];
    if (league !== 'all') urls.push(`${ESPN_BASE}/site/v2/sports/soccer/all/summary?event=${id}`);
    let data: any = null;
    for (const url of urls) {
      const res = await fetch(url, { next: { revalidate: 180 } });
      if (res.ok) { data = await res.json(); if (data?.header || data?.boxscore) break; }
    }
    if (!data) return NextResponse.json({ error: 'Detail pertandingan tidak tersedia' }, { status: 502 });
    const headerComp = data?.header?.competitions?.[0] ?? data?.competitions?.[0] ?? {};
    const competitors: any[] = headerComp.competitors ?? [];
    const juveSide = competitors.find((t) => String(t.team?.id) === JUVE_ID);
    const oppSide = competitors.find((t) => String(t.team?.id) !== JUVE_ID);
    const teams: any[] = data?.boxscore?.teams ?? [];
    const juve = teams.find((t) => String(t.team?.id) === JUVE_ID);
    const opp = teams.find((t) => String(t.team?.id) !== JUVE_ID);
    const get = (t: any, name: string) => t?.statistics?.find((s: any) => s.name === name)?.displayValue;
    const stats = STAT_LABELS.map(([name, label]) => ({ key: name, label, juve: get(juve, name), opp: get(opp, name) }))
      .filter((s) => s.juve !== undefined && s.opp !== undefined);
    const details: any[] = headerComp.details ?? data?.plays?.items ?? [];
    const timeline = details.map((d: any) => {
      const type = str(d.type?.text ?? d.type?.name);
      const isGoal = Boolean(d.scoringPlay) || /goal/i.test(type);
      const isYellow = Boolean(d.yellowCard) || /yellow card/i.test(type);
      const isRed = Boolean(d.redCard) || /red card/i.test(type);
      const isSub = /substitution/i.test(type);
      if (!isGoal && !isYellow && !isRed && !isSub) return null;
      return { minute: str(d.clock?.displayValue ?? d.time?.displayValue), type: isGoal ? (d.ownGoal ? 'Gol bunuh diri' : d.penaltyKick ? 'Gol penalti' : 'Gol') : isYellow ? 'Kartu kuning' : isRed ? 'Kartu merah' : 'Pergantian pemain', teamId: str(d.team?.id), player: str(d.athletesInvolved?.[0]?.displayName ?? d.athletesInvolved?.[0]?.shortName), secondaryPlayer: str(d.athletesInvolved?.[1]?.displayName ?? d.athletesInvolved?.[1]?.shortName), isJuve: str(d.team?.id) === JUVE_ID };
    }).filter(Boolean);
    const lineupGroups: any[] = data?.boxscore?.players ?? [];
    const lineups = lineupGroups.map((group: any) => ({ team: str(group.team?.displayName), teamId: str(group.team?.id), isJuve: str(group.team?.id) === JUVE_ID, groups: (group.statistics ?? []).flatMap((stat: any) => (stat.athletes ?? []).map((a: any) => ({ name: str(a.athlete?.displayName), position: str(a.athlete?.position?.abbreviation ?? a.athlete?.position), jersey: str(a.athlete?.jersey), starter: Boolean(a.starter), subbedIn: Boolean(a.didEnter), subbedOut: Boolean(a.didLeave) }))) }));
    return NextResponse.json({
      stats, timeline, lineups,
      opponent: oppSide?.team?.displayName ?? opp?.team?.displayName ?? '',
      venue: data?.gameInfo?.venue?.fullName ?? headerComp?.venue?.fullName ?? '',
      attendance: data?.gameInfo?.attendance ?? null,
      referee: data?.gameInfo?.officials?.[0]?.displayName ?? '',
      score: { juve: juveSide?.score ?? null, opponent: oppSide?.score ?? null },
      status: headerComp.status?.type?.detail ?? headerComp.status?.type?.description ?? '',
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server saat mengambil detail pertandingan' }, { status: 500 });
  }
}
