// "Juventus di Timnas": pemain Juventus saat membela negaranya selama jeda internasional.
// Sumber: ESPN (jadwal/skor timnas senior + susunan pemain tiap laga). ESPN tidak punya daftar panggilan resmi,
// jadi "dipanggil" = tercatat di susunan pemain (inti atau cadangan) sebuah laga. Rating = estimasi dari lib/ratings.ts,
// bukan rating resmi. Semua fungsi pengambil data tidak melempar error; data yang tak ada bernilai kosong.
import { eventState, getScoreboard } from './espn';
import { countryId, countryInfo, flagUrl } from './countries';
import { fetchInjuries } from './injuries';
import { loadJuve } from './juve';
import { buildLiveMatch, fetchSummary } from './live';
import { findPlayer, normName } from './names';
import { buildRatings, type RatedPlayer } from './ratings';
import { fetchFotmob, fetchTransfermarkt, withFotmobPhotos } from './squad';
import type { SquadPlayer } from './types';

/* ---------- jeda internasional ---------- */

export interface BreakDef {
  key: string;
  label: string;
  /** tanggal ISO (UTC) awal dan akhir jendela pencarian laga */
  from: string;
  to: string;
}

/** Jendela tanggal dibuat sedikit lebih lebar dari kalender FIFA; laga klub tidak ikut karena hanya kompetisi timnas yang dicari. */
export const BREAKS: BreakDef[] = [
  { key: 'sep-okt-2026', label: 'Jeda Sep–Okt 2026', from: '2026-09-21', to: '2026-10-14' },
  { key: 'nov-2026', label: 'Jeda November 2026', from: '2026-11-09', to: '2026-11-18' },
];

export type BreakState = 'selesai' | 'berlangsung' | 'akan datang';

export function breakState(b: BreakDef, now = new Date()): BreakState {
  const start = new Date(`${b.from}T00:00:00Z`).getTime();
  const end = new Date(`${b.to}T23:59:59Z`).getTime() + 86_400_000;
  return now.getTime() < start ? 'akan datang' : now.getTime() > end ? 'selesai' : 'berlangsung';
}

/** Jeda yang tampil pertama: yang sedang berlangsung, kalau tidak ada yang terakhir selesai, kalau tidak ada yang berikutnya. */
export function defaultBreak(now = new Date()): BreakDef {
  const withState = BREAKS.map((b) => ({ b, s: breakState(b, now) }));
  return (
    withState.find((x) => x.s === 'berlangsung')?.b ?? [...withState].reverse().find((x) => x.s === 'selesai')?.b ?? withState[0].b
  );
}

const NATIONAL = [
  { slug: 'fifa.friendly', name: 'Laga persahabatan' },
  { slug: 'uefa.nations', name: 'UEFA Nations League' },
  { slug: 'concacaf.nations.league', name: 'CONCACAF Nations League' },
  { slug: 'caf.nations_qual', name: 'Kualifikasi Piala Afrika' },
] as const;
const compName = (slug: string) => NATIONAL.find((c) => c.slug === slug)?.name ?? slug;

/* ---------- tipe respons ---------- */

export type Tone = 'red' | 'orange' | 'yellow' | 'green';

export interface TmSide {
  name: string;
  country: string; // nama Indonesia bila dikenal
  flag: string;
  score: number | null;
}

export interface TmEntry {
  playerId: string;
  side: 'home' | 'away';
  rating: number | null;
  minutes: number;
  started: boolean;
  goals: number;
  assists: number;
  injuredOff: boolean;
}

export interface TmMatch {
  id: string;
  competition: string;
  iso: string;
  venue: string;
  status: 'pre' | 'live' | 'post';
  home: TmSide;
  away: TmSide;
  entries: TmEntry[];
}

export interface TmPlayer {
  id: string;
  name: string;
  photo: string;
  position: string;
  country: string;
  flag: string;
  /** laga negaranya yang selesai di jendela ini */
  countryMatches: number;
  /** laga tempat ia tercatat di susunan pemain (inti atau cadangan) */
  inSquad: number;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  avgRating: number | null;
  ratings: { matchId: string; rating: number | null; goals: number; assists: number }[];
  restDays: number | null;
  clubInjured: boolean;
  injuredOnDuty: boolean;
  status: { tone: Tone; label: string };
  /** 0–1, beban menit dibanding 4 laga penuh */
  load: number;
}

export interface TmCountry {
  country: string;
  flag: string;
  playerIds: string[];
  matchIds: string[];
  /** pemain skuad berkebangsaan ini yang tidak tercatat di susunan laga mana pun */
  notListed: string[];
}

export interface TimnasResponse {
  breakKey: string;
  breaks: { key: string; label: string; state: BreakState }[];
  state: BreakState;
  matches: TmMatch[];
  players: TmPlayer[];
  countries: TmCountry[];
  totals: { called: number; played: number; goals: number; assists: number; minutes: number; matches: number; injured: string[] };
  best: { playerId: string; avg: number; matches: number } | null;
  top: { playerId: string; goals: number; assists: number } | null;
  derby: string[]; // id laga
  afterBreak: { opponent: string; iso: string; competition: string } | null;
  warnings: string[];
  updatedAt: string;
}

/* ---------- data mentah ---------- */

export interface RawMatch {
  id: string;
  slug: string;
  iso: string;
  venue: string;
  status: 'pre' | 'live' | 'post';
  home: { name: string; score: number | null };
  away: { name: string; score: number | null };
  players: { home: RatedPlayer[]; away: RatedPlayer[] };
  startedIds: { home: Set<string>; away: Set<string> };
  /** nama pemain yang diganti karena cedera (dari teks pergantian ESPN) */
  injured: string[];
  hasRosters: boolean;
}

const countryKey = (name: string) => countryInfo(name)?.code ?? normName(name).join(' ');

/** "… replaces X because of an injury" → X */
export function injuredFromText(texts: string[]): string[] {
  const out: string[] = [];
  for (const t of texts) {
    const m = /replaces\s+(.+?)\s+because of an? (?:injury|knock)/i.exec(t);
    if (m) out.push(m[1].trim());
  }
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

/** Ambil laga timnas yang melibatkan negara pemain Juventus, lengkap dengan susunan pemain bila laga sudah selesai. */
export async function collectMatches(b: BreakDef, squad: SquadPlayer[]): Promise<RawMatch[]> {
  const wanted = new Set(squad.flatMap((p) => p.nation.map(countryKey)));
  const range = `${b.from.replace(/-/g, '')}-${b.to.replace(/-/g, '')}`;
  const lists = await Promise.all(NATIONAL.map((c) => getScoreboard(c.slug, range, 600)));

  const seen = new Set<string>();
  const events = lists
    .flat()
    .filter((e) => {
      const id = String(e?.id);
      if (seen.has(id)) return false;
      seen.add(id);
      const teams = (e?.competitions?.[0]?.competitors ?? []).map((c: any) => countryKey(String(c?.team?.displayName ?? c?.team?.name ?? '')));
      return teams.some((t: string) => wanted.has(t));
    })
    .sort((a, c) => new Date(a.date).getTime() - new Date(c.date).getTime());

  return mapLimit(events, 6, async (e): Promise<RawMatch> => {
    const comps: any[] = e?.competitions?.[0]?.competitors ?? [];
    const home = comps.find((c) => c.homeAway === 'home') ?? comps[0];
    const away = comps.find((c) => c.homeAway === 'away') ?? comps[1];
    const status = eventState(e);
    const score = (c: any) => (status === 'pre' || c?.score == null ? null : Number(c.score));
    const raw: RawMatch = {
      id: String(e.id),
      slug: String(e._league),
      iso: String(e.date),
      venue: String(e?.competitions?.[0]?.venue?.fullName ?? ''),
      status,
      home: { name: String(home?.team?.displayName ?? home?.team?.name ?? ''), score: score(home) },
      away: { name: String(away?.team?.displayName ?? away?.team?.name ?? ''), score: score(away) },
      players: { home: [], away: [] },
      startedIds: { home: new Set(), away: new Set() },
      injured: [],
      hasRosters: false,
    };
    if (status !== 'post') return raw;

    try {
      const summary = await fetchSummary(raw.slug, raw.id, false);
      if (!summary) return raw;
      const live = buildLiveMatch(e, summary);
      const rated = buildRatings(summary, live, null, []); // tanpa FotMob: rating = estimasi dari statistik ESPN
      for (const side of ['home', 'away'] as const) {
        const team = rated[side];
        raw.startedIds[side] = new Set(team.rows.flat().map((p) => p.id));
        raw.players[side] = [...team.rows.flat(), ...team.subs];
      }
      raw.hasRosters = raw.players.home.length + raw.players.away.length > 0;
      raw.injured = injuredFromText([...(summary.keyEvents ?? []), ...(summary.commentary ?? [])].map((x: any) => String(x?.text ?? x?.shortText ?? '')));
    } catch {
      /* laga ini tampil tanpa pemain */
    }
    return raw;
  });
}

/* ---------- agregasi (murni, mudah diuji) ---------- */

const round1 = (n: number) => Math.round(n * 10) / 10;
const DAY = 86_400_000;

export interface AggregateInput {
  raw: RawMatch[];
  squad: SquadPlayer[];
  /** daftar pemain yang sedang cedera di klub (nama) */
  clubInjured: { name: string }[];
  /** jam mulai laga klub (ISO), urut naik */
  clubTimes: string[];
  clubNext: { opponent: string; iso: string; competition: string }[];
  now?: Date;
}

export function aggregate(inp: AggregateInput): Omit<TimnasResponse, 'breakKey' | 'breaks' | 'state' | 'warnings' | 'updatedAt'> {
  const { raw, squad, clubInjured, clubTimes, clubNext } = inp;
  const finished = raw.filter((m) => m.status === 'post');

  // 1) Cocokkan pemain skuad ke susunan tiap laga negaranya
  const entriesByMatch = new Map<string, TmEntry[]>();
  // team = nama negara dalam bahasa Inggris seperti di ESPN (dipakai sebagai kunci pencocokan)
  const perPlayer = new Map<string, { p: SquadPlayer; matchIds: string[]; team: string }>();

  for (const m of raw) {
    const entries: TmEntry[] = [];
    for (const side of ['home', 'away'] as const) {
      const teamName = m[side].name;
      const key = countryKey(teamName);
      for (const p of squad) {
        if (!p.nation.some((n) => countryKey(n) === key)) continue;
        const hit = findPlayer(p.name, m.players[side]);
        if (!hit) continue;
        const played = hit.rating !== null;
        entries.push({
          playerId: p.id,
          side,
          rating: hit.rating,
          minutes: played ? hit.minutes : 0,
          started: m.startedIds[side].has(hit.id),
          goals: hit.goals,
          assists: hit.assists,
          injuredOff: m.injured.some((n) => findPlayer(n, [{ name: hit.name }]) !== null),
        });
        const cur = perPlayer.get(p.id) ?? { p, matchIds: [], team: teamName };
        cur.matchIds.push(m.id);
        perPlayer.set(p.id, cur);
      }
    }
    entriesByMatch.set(m.id, entries);
  }

  const clubInj = (name: string) => findPlayer(name, clubInjured) !== null;
  const nextClubAfter = (iso: string) => clubTimes.find((t) => new Date(t).getTime() > new Date(iso).getTime()) ?? null;

  // 2) Ringkasan per pemain
  const players: TmPlayer[] = [];
  for (const { p, matchIds, team } of perPlayer.values()) {
    const country = countryId(team);
    const flag = flagUrl(team);
    const myMatches = finished.filter((m) => matchIds.includes(m.id));
    const key = countryKey(team);
    const countryMatches = finished.filter((m) => countryKey(m.home.name) === key || countryKey(m.away.name) === key).length;
    const mine = myMatches.map((m) => ({ m, e: entriesByMatch.get(m.id)!.find((x) => x.playerId === p.id)! }));
    const played = mine.filter((x) => x.e.minutes > 0);
    const minutes = played.reduce((n, x) => n + x.e.minutes, 0);
    const rated = played.filter((x) => x.e.rating !== null);
    const last = played.length ? played[played.length - 1].m.iso : mine.length ? mine[mine.length - 1].m.iso : null;
    const next = last ? nextClubAfter(last) : null;
    const restDays = last && next ? Math.max(0, Math.floor((new Date(next).getTime() - new Date(last).getTime()) / DAY)) : null;
    const injuredOnDuty = mine.some((x) => x.e.injuredOff);
    const clubInjured_ = clubInj(p.name);

    let status: TmPlayer['status'] = { tone: 'green', label: 'Aman' };
    if (injuredOnDuty) status = { tone: 'red', label: 'Cedera saat bertugas' };
    else if (clubInjured_) status = { tone: 'orange', label: 'Masuk daftar cedera klub' };
    else if (minutes >= 270 || (minutes >= 180 && restDays != null && restDays <= 3)) status = { tone: 'yellow', label: 'Rawan lelah' };

    players.push({
      id: p.id,
      name: p.name,
      photo: p.photo,
      position: p.position,
      country,
      flag,
      countryMatches,
      inSquad: mine.length,
      appearances: played.length,
      minutes,
      goals: mine.reduce((n, x) => n + x.e.goals, 0),
      assists: mine.reduce((n, x) => n + x.e.assists, 0),
      avgRating: rated.length ? round1(rated.reduce((n, x) => n + (x.e.rating as number), 0) / rated.length) : null,
      ratings: mine.map((x) => ({ matchId: x.m.id, rating: x.e.minutes > 0 ? x.e.rating : null, goals: x.e.goals, assists: x.e.assists })),
      restDays,
      clubInjured: clubInjured_,
      injuredOnDuty,
      status,
      load: Math.min(1, minutes / 360),
    });
  }
  players.sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));

  // 3) Per negara
  const listedIds = new Set(players.map((p) => p.id));
  const countryMap = new Map<string, TmCountry>();
  const ensure = (name: string) => {
    const k = countryKey(name);
    if (!countryMap.has(k)) countryMap.set(k, { country: countryId(name), flag: flagUrl(name), playerIds: [], matchIds: [], notListed: [] });
    return countryMap.get(k)!;
  };
  const wantedKeys = new Set(squad.flatMap((p) => p.nation.map(countryKey)));
  for (const m of raw) {
    for (const side of ['home', 'away'] as const) {
      if (wantedKeys.has(countryKey(m[side].name))) ensure(m[side].name).matchIds.push(m.id);
    }
  }
  for (const pl of players) ensure(perPlayer.get(pl.id)!.team).playerIds.push(pl.id);
  for (const [key, c] of countryMap) {
    c.notListed = squad.filter((p) => !listedIds.has(p.id) && p.nation.some((n) => countryKey(n) === key)).map((p) => p.name);
  }
  const countries = [...countryMap.values()]
    .filter((c) => c.playerIds.length || c.matchIds.length)
    .sort((a, b) => b.playerIds.length - a.playerIds.length || a.country.localeCompare(b.country));

  // 4) Sorotan, derby, total
  const ratedPlayers = players.filter((p) => p.avgRating !== null && p.ratings.filter((r) => r.rating !== null).length >= 1);
  const best = ratedPlayers.length
    ? [...ratedPlayers].sort((a, b) => (b.avgRating as number) - (a.avgRating as number) || b.minutes - a.minutes)[0]
    : null;
  const top = [...players].filter((p) => p.goals + p.assists > 0).sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals)[0] ?? null;
  const derby = finished.filter((m) => {
    const e = entriesByMatch.get(m.id) ?? [];
    return e.some((x) => x.side === 'home') && e.some((x) => x.side === 'away');
  }).map((m) => m.id);

  const lastEnd = finished.length ? finished[finished.length - 1].iso : null;
  const after = lastEnd ? clubNext.find((c) => new Date(c.iso).getTime() > new Date(lastEnd).getTime()) ?? null : clubNext.find((c) => new Date(c.iso).getTime() > (inp.now ?? new Date()).getTime()) ?? null;

  const matches: TmMatch[] = raw.map((m) => ({
    id: m.id,
    competition: compName(m.slug),
    iso: m.iso,
    venue: m.venue,
    status: m.status,
    home: { name: m.home.name, country: countryId(m.home.name), flag: flagUrl(m.home.name), score: m.home.score },
    away: { name: m.away.name, country: countryId(m.away.name), flag: flagUrl(m.away.name), score: m.away.score },
    entries: entriesByMatch.get(m.id) ?? [],
  }));

  return {
    matches,
    players,
    countries,
    totals: {
      called: players.length,
      played: players.filter((p) => p.minutes > 0).length,
      goals: players.reduce((n, p) => n + p.goals, 0),
      assists: players.reduce((n, p) => n + p.assists, 0),
      minutes: players.reduce((n, p) => n + p.minutes, 0),
      matches: finished.length,
      injured: players.filter((p) => p.injuredOnDuty).map((p) => p.name),
    },
    best: best ? { playerId: best.id, avg: best.avgRating as number, matches: best.ratings.filter((r) => r.rating !== null).length } : null,
    top: top ? { playerId: top.id, goals: top.goals, assists: top.assists } : null,
    derby,
    afterBreak: after,
  };
}

/* ---------- gabungan ---------- */

async function loadSquad(): Promise<SquadPlayer[]> {
  const fm = fetchFotmob().catch(() => null);
  try {
    const { players } = await fetchTransfermarkt();
    const f = await fm;
    return f ? withFotmobPhotos(players, f.players) : players;
  } catch {
    return (await fm)?.players ?? [];
  }
}

const cache = new Map<string, { at: number; body: TimnasResponse }>();

export async function fetchTimnas(key?: string | null, now = new Date()): Promise<TimnasResponse | null> {
  const def = BREAKS.find((b) => b.key === key) ?? defaultBreak(now);
  const hit = cache.get(def.key);
  if (hit && now.getTime() - hit.at < 10 * 60_000) return hit.body;

  const squad = await loadSquad();
  if (!squad.length) return null;

  const [raw, injuries, juve] = await Promise.all([
    collectMatches(def, squad),
    fetchInjuries().catch(() => null),
    loadJuve().catch(() => null),
  ]);

  const club = juve ? [...juve.past, ...juve.upcoming].sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime()) : [];
  const agg = aggregate({
    raw,
    squad,
    clubInjured: injuries?.players ?? [],
    clubTimes: club.map((m) => m.iso),
    clubNext: club.map((m) => ({ opponent: m.opponent, iso: m.iso, competition: m.competition })),
    now,
  });

  const warnings: string[] = [];
  const noRoster = raw.filter((m) => m.status === 'post' && !m.hasRosters).length;
  if (noRoster) warnings.push(`${noRoster} laga selesai tanpa data susunan pemain dari ESPN.`);
  if (!injuries) warnings.push('Daftar cedera klub (FotMob) tidak bisa dimuat, jadi status "Masuk daftar cedera klub" tidak dihitung.');
  if (!juve) warnings.push('Jadwal laga klub tidak bisa dimuat, jadi hari rehat tidak dihitung.');

  const body: TimnasResponse = {
    breakKey: def.key,
    breaks: BREAKS.map((b) => ({ key: b.key, label: b.label, state: breakState(b, now) })),
    state: breakState(def, now),
    ...agg,
    warnings,
    updatedAt: now.toISOString(),
  };
  if (raw.length) cache.set(def.key, { at: now.getTime(), body });
  return body;
}
