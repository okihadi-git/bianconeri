// Skor live / hasil laga terbaru Juventus untuk beranda (timeline, susunan pemain, statistik).
import { COMPETITIONS, ESPN_BASE, JUVE_ID, addDays, competitionName, eventState, getScoreboard, toNum, ymd } from './espn';
import { fmtParts, isJuveEvent } from './juve';
import type { Lineup, LineupPlayer, LiveMatch, LiveSide, LiveStat, ScorerLine, TimelineItem } from './types';

/** Hasil laga tetap tampil di beranda selama sekian jam sejak kick-off. */
export const RECENT_HOURS = 72;

export const STAT_LABELS: [string, string][] = [
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

/* ---------- ambil data ---------- */

/** Laga Juventus dari beberapa hari lalu sampai besok, cache pendek supaya skor live tetap segar. */
export async function fetchRecentJuveEvents(): Promise<any[]> {
  const now = new Date();
  const range = `${ymd(addDays(now, -4))}-${ymd(addDays(now, 1))}`;
  const lists = await Promise.all(COMPETITIONS.map((c) => getScoreboard(c.slug, range, 30)));
  const seen = new Set<string>();
  return lists
    .flat()
    .filter(isJuveEvent)
    .filter((e) => {
      const id = String(e.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

/** Laga yang sedang berjalan; kalau tidak ada, laga selesai terbaru dalam RECENT_HOURS. */
export function pickLiveEvent(events: any[], now = Date.now()): any | null {
  const live = events.filter((e) => eventState(e) === 'live');
  if (live.length) return live[0];
  const cutoff = now - RECENT_HOURS * 3600 * 1000;
  const recent = events
    .filter((e) => eventState(e) === 'post' && new Date(e.date).getTime() >= cutoff)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return recent[0] ?? null;
}

export async function fetchSummary(league: string, id: string, live: boolean): Promise<any | null> {
  const urls = [`${ESPN_BASE}/site/v2/sports/soccer/${league}/summary?event=${id}`, `${ESPN_BASE}/site/v2/sports/soccer/all/summary?event=${id}`];
  for (const url of urls) {
    try {
      const res = await fetch(url, { next: { revalidate: live ? 20 : 300 } });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.boxscore || data?.keyEvents || data?.rosters) return data;
    } catch {
      /* coba URL berikutnya */
    }
  }
  return null;
}

/* ---------- util kecil ---------- */

const tick = (s: unknown) => String(s ?? '').replace(/[′’]/g, "'").trim();

/** "45'+2'" → "45+2'" */
function fmtMinute(raw: unknown): string {
  const m = tick(raw).replace(/'\s*\+\s*/g, '+');
  if (!m) return '';
  return /\d$/.test(m) ? `${m}'` : m;
}

function minuteToSeconds(minute: string): number {
  const m = /^(\d+)(?:\+(\d+))?/.exec(minute);
  return m ? (Number(m[1]) + Number(m[2] ?? 0) * 0.001) * 60 : 0;
}

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim();

function sameName(a: string, b: string): boolean {
  if (!a || !b) return false;
  const x = plain(a);
  const y = plain(b);
  if (x === y) return true;
  const lx = x.split(/\s+/).pop() ?? '';
  const ly = y.split(/\s+/).pop() ?? '';
  return lx.length >= 4 && lx === ly;
}

/* ---------- timeline ---------- */

export interface RawEv {
  type: string;
  scoring: boolean;
  teamId: string;
  period: number;
  clockText: string;
  clockSeconds: number | null;
  text: string;
  players: string[];
}

function rawFromKeyEvents(list: any[]): RawEv[] {
  return list.map((e) => ({
    type: `${e?.type?.type ?? ''} ${e?.type?.text ?? ''}`.toLowerCase(),
    scoring: Boolean(e?.scoringPlay),
    teamId: String(e?.team?.id ?? ''),
    period: Number(e?.period?.number ?? 0),
    clockText: tick(e?.clock?.displayValue ?? e?.clock?.displayName ?? ''),
    clockSeconds: Number.isFinite(Number(e?.clock?.value)) && e?.clock?.value !== undefined ? Number(e.clock.value) : null,
    text: String(e?.text ?? e?.shortText ?? ''),
    players: (e?.participants ?? []).map((p: any) => p?.athlete?.displayName || p?.athlete?.shortName || '').filter(Boolean),
  }));
}

/** Cadangan: `details` di scoreboard (hanya gol & kartu). */
function rawFromDetails(list: any[]): RawEv[] {
  return list.map((d) => ({
    type: `${d?.type?.text ?? ''} ${d?.penaltyKick ? 'penalty' : ''} ${d?.ownGoal ? 'own goal' : ''} ${d?.yellowCard ? 'yellow card' : ''} ${d?.redCard ? 'red card' : ''}`.toLowerCase(),
    scoring: Boolean(d?.scoringPlay),
    teamId: String(d?.team?.id ?? ''),
    period: 0,
    clockText: tick(d?.clock?.displayValue ?? ''),
    clockSeconds: Number.isFinite(Number(d?.clock?.value)) && d?.clock?.value !== undefined ? Number(d.clock.value) : null,
    text: '',
    players: (d?.athletesInvolved ?? []).map((a: any) => a?.displayName || a?.shortName || '').filter(Boolean),
  }));
}

export function buildTimeline(raw: RawEv[], homeId: string, awayId: string): TimelineItem[] {
  const out: TimelineItem[] = [];
  raw.forEach((e, i) => {
    if (e.period >= 5) return; // adu penalti tidak dimasukkan ke timeline
    const minute = fmtMinute(e.clockText);
    const base = e.clockSeconds ?? minuteToSeconds(minute);
    const side: TimelineItem['side'] = e.teamId === homeId ? 'home' : e.teamId === awayId ? 'away' : 'none';
    const item = (kind: TimelineItem['kind'], player: string, related: string, label: string): TimelineItem => ({
      id: `${i}-${kind}`,
      minute,
      sort: base * 1000 + i,
      kind,
      side,
      player,
      related,
      label,
    });

    const t = e.type;
    const assist = /assisted by\s+(.+?)(?:\s+with\b|\s+following\b|\s+from\b|\.|$)/i.exec(e.text)?.[1] ?? e.players[1] ?? '';

    if (/own.?goal/.test(t)) return void out.push(item('own-goal', e.players[0] ?? '', '', 'Gol bunuh diri'));
    if (e.scoring) return void out.push(item(/penalty/.test(t) ? 'pen-goal' : 'goal', e.players[0] ?? '', assist, /penalty/.test(t) ? 'Gol penalti' : 'Gol'));
    if (/penalty/.test(t) && /(miss|saved|post|wide|off)/.test(t)) return void out.push(item('pen-miss', e.players[0] ?? '', '', 'Penalti gagal'));
    if (/yellow.?red|second.?yellow/.test(t)) return void out.push(item('red', e.players[0] ?? '', '', 'Kuning kedua'));
    if (/red.?card/.test(t)) return void out.push(item('red', e.players[0] ?? '', '', 'Kartu merah'));
    if (/yellow/.test(t)) return void out.push(item('yellow', e.players[0] ?? '', '', 'Kartu kuning'));
    if (/substitution/.test(t)) {
      const m = /\.\s*(.+?)\s+replaces\s+(.+?)(?:\s+because\b.*|\.\s*$|$)/i.exec(e.text);
      const on = m?.[1] ?? e.players[0] ?? '';
      const off = m?.[2] ?? e.players[1] ?? '';
      return void out.push(item('sub', on, off, 'Pergantian pemain'));
    }
    if (/half.?time|half-time|end.?half|end.?1st/.test(t)) {
      return void out.push({ ...item('period', '', '', 'Turun minum'), side: 'none' });
    }
    if (/full.?time|end.?regular|end.?of.?match|end.?extra|match.?end/.test(t)) {
      return void out.push({ ...item('period', '', '', 'Peluit panjang'), side: 'none' });
    }
  });
  return out.sort((a, b) => a.sort - b.sort);
}

export function buildScorers(timeline: TimelineItem[]): { home: ScorerLine[]; away: ScorerLine[] } {
  const res = { home: [] as ScorerLine[], away: [] as ScorerLine[] };
  for (const t of timeline) {
    if (t.side === 'none' || !['goal', 'pen-goal', 'own-goal'].includes(t.kind)) continue;
    res[t.side].push({
      name: t.player,
      minute: t.minute,
      tag: t.kind === 'pen-goal' ? 'pen' : t.kind === 'own-goal' ? 'b.d.' : '',
    });
  }
  return res;
}

/* ---------- susunan pemain ---------- */

function buildLineup(r: any, timeline: TimelineItem[], side: 'home' | 'away'): Lineup {
  const teamId = String(r?.team?.id ?? '');
  const formation = tick(r?.formation?.name ?? r?.formation ?? '');

  const mine = timeline.filter((t) => t.side === side);
  const count = (name: string, kinds: TimelineItem['kind'][]) =>
    mine.filter((t) => kinds.includes(t.kind) && sameName(t.player, name)).length;

  const map = (p: any): LineupPlayer => {
    const a = p?.athlete ?? {};
    const name = String(a.displayName ?? a.shortName ?? a.fullName ?? '');
    const stat = (n: string) => Number((p?.stats ?? []).find((s: any) => s?.name === n)?.value ?? 0) || 0;
    const on = mine.find((t) => t.kind === 'sub' && sameName(t.player, name));
    const off = mine.find((t) => t.kind === 'sub' && sameName(t.related, name));
    return {
      id: String(a.id ?? p?.id ?? name),
      name,
      jersey: String(p?.jersey ?? a.jersey ?? ''),
      position: String(p?.position?.abbreviation ?? a?.position?.abbreviation ?? ''),
      place: Number(p?.formationPlace ?? 0) || 0,
      subOn: on?.minute ?? '',
      subOff: off?.minute ?? '',
      goals: Math.max(stat('totalGoals'), count(name, ['goal', 'pen-goal'])),
      yellow: Math.max(stat('yellowCards'), count(name, ['yellow'])),
      red: Math.max(stat('redCards'), count(name, ['red'])),
    };
  };

  const all: any[] = Array.isArray(r?.roster) ? r.roster : [];
  const starters = all.filter((p) => p?.starter === true).map(map);
  const subs = all.filter((p) => p?.starter !== true).map(map).filter((p) => p.name);
  starters.sort((a, b) => a.place - b.place);
  subs.sort((a, b) => (Number(a.jersey) || 99) - (Number(b.jersey) || 99));

  return { teamId, name: String(r?.team?.displayName ?? ''), formation, starters, subs };
}

/* ---------- statistik ---------- */

function buildStats(summary: any, homeId: string, awayId: string): LiveStat[] {
  const teams: any[] = summary?.boxscore?.teams ?? [];
  const home = teams.find((t) => String(t?.team?.id) === homeId);
  const away = teams.find((t) => String(t?.team?.id) === awayId);
  const get = (t: any, name: string): string | undefined => t?.statistics?.find((s: any) => s?.name === name)?.displayValue;
  return STAT_LABELS.map(([key, label]) => ({ key, label, home: get(home, key) as string, away: get(away, key) as string })).filter(
    (s) => s.home !== undefined && s.away !== undefined
  );
}

/* ---------- gabungkan ---------- */

function statusText(event: any): string {
  const comp = event?.competitions?.[0];
  const st = comp?.status ?? event?.status ?? {};
  const t = st.type ?? {};
  if (t.state === 'post' || t.completed) {
    const d = String(t.detail ?? t.shortDetail ?? '');
    if (/pen/i.test(d)) return 'Selesai · adu penalti';
    if (/aet|extra/i.test(d)) return 'Selesai · perpanjangan waktu';
    return 'Selesai';
  }
  if (t.name === 'STATUS_HALFTIME' || /half.?time/i.test(String(t.description ?? ''))) return 'Turun minum';
  const clock = tick(st.displayClock);
  const babak = st.period === 1 ? 'Babak 1' : st.period === 2 ? 'Babak 2' : st.period >= 3 ? 'Perpanjangan' : 'Live';
  return clock ? `${babak} · ${clock}` : babak;
}

export function buildLiveMatch(event: any, summary: any | null): LiveMatch {
  const comp = event.competitions?.[0];
  const competitors: any[] = comp?.competitors ?? [];
  const homeC = competitors.find((c) => c.homeAway === 'home') ?? competitors[0];
  const awayC = competitors.find((c) => c.homeAway === 'away') ?? competitors[1];
  const side = (c: any): LiveSide => ({
    id: String(c?.team?.id ?? ''),
    name: c?.team?.displayName ?? 'TBA',
    abbr: c?.team?.abbreviation ?? '',
    logo: c?.team?.logos?.[0]?.href || c?.team?.logo || '',
    score: toNum(c?.score),
    isJuve: String(c?.team?.id) === JUVE_ID,
  });
  const home = side(homeC);
  const away = side(awayC);

  const keyEvents: any[] = Array.isArray(summary?.keyEvents) ? summary.keyEvents : [];
  const raw = keyEvents.length ? rawFromKeyEvents(keyEvents) : rawFromDetails(comp?.details ?? []);
  const timeline = buildTimeline(raw, home.id, away.id);

  const rosters: any[] = Array.isArray(summary?.rosters) ? summary.rosters : [];
  const rosterFor = (id: string, ha: 'home' | 'away') =>
    rosters.find((r) => String(r?.team?.id) === id) ?? rosters.find((r) => r?.homeAway === ha);
  const rh = rosterFor(home.id, 'home');
  const ra = rosterFor(away.id, 'away');

  const date = new Date(event.date);
  const so = homeC?.shootoutScore !== undefined && awayC?.shootoutScore !== undefined
    ? { home: toNum(homeC.shootoutScore), away: toNum(awayC.shootoutScore) }
    : null;
  const state = eventState(event) === 'live' ? 'live' : 'post';

  return {
    id: String(event.id),
    league: String(event._league ?? ''),
    competition: competitionName(String(event._league ?? '')),
    round: String(comp?.notes?.[0]?.headline ?? ''),
    state,
    statusText: statusText(event),
    iso: date.toISOString(),
    ...fmtParts(date),
    venue: summary?.gameInfo?.venue?.fullName ?? comp?.venue?.fullName ?? '',
    referee: summary?.gameInfo?.officials?.[0]?.displayName ?? '',
    attendance: summary?.gameInfo?.attendance ?? null,
    home,
    away,
    shootout: so,
    scorers: buildScorers(timeline),
    timeline,
    lineups: {
      home: rh ? { ...buildLineup(rh, timeline, 'home'), teamId: home.id } : null,
      away: ra ? { ...buildLineup(ra, timeline, 'away'), teamId: away.id } : null,
    },
    stats: buildStats(summary, home.id, away.id),
  };
}
