// Rating pemain (estimasi) untuk satu laga: dihitung dari ringkasan (summary) ESPN.
// ESPN tidak punya rating resmi, jadi angka ini perkiraan otomatis dengan skala 6,0 = rata-rata.
import { findPlayer, type FmMatch, type FmPlayer } from './fotmob';
import { layoutLines } from './pitch';
import type { LineupPlayer, LiveMatch } from './types';

export type PosGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface RatedPlayer {
  id: string;
  name: string;
  jersey: string;
  position: string;
  rating: number | null; // null = tidak bermain
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  subOn: string;
  subOff: string;
  photo: string;
  minutes: number;
  best: boolean;
}

export interface RatedTeam {
  teamId: string;
  name: string;
  logo: string;
  isJuve: boolean;
  formation: string;
  avg: number | null;
  coach: { name: string; photo: string } | null;
  /** baris untuk digambar di lapangan: kiper dulu, lalu bek → penyerang */
  rows: RatedPlayer[][];
  subs: RatedPlayer[];
}

export interface RatingResponse {
  id: string;
  competition: string;
  dateLabel: string;
  home: RatedTeam;
  away: RatedTeam;
  score: { home: number; away: number };
  /** 'fotmob' = rating resmi FotMob; 'estimate' = perkiraan sendiri dari statistik ESPN */
  source: 'fotmob' | 'estimate';
  best: { player: RatedPlayer; team: string; teamLogo: string } | null;
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

const plain = (s: string) =>
  String(s ?? '')
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

const minuteNum = (m: string) => {
  const r = /^(\d+)(?:\+(\d+))?/.exec(String(m ?? '').trim());
  return r ? Number(r[1]) + Number(r[2] ?? 0) : null;
};

export function groupOf(abbr: string): PosGroup {
  const a = String(abbr ?? '').toUpperCase();
  if (/^G/.test(a)) return 'GK';
  if (/^(CD|LB|RB|SW|WB|LWB|RWB|D)/.test(a)) return 'DEF';
  if (/M/.test(a)) return 'MID';
  return 'FWD';
}

interface Ctx {
  result: number; // +1 menang, 0 seri, -1 kalah (dari sisi tim pemain)
  conceded: number;
}

function estimate(p: { group: PosGroup; minutes: number; stats: Record<string, number>; goals: number; assists: number; yellow: number; red: number }, ctx: Ctx): number {
  const s = p.stats;
  let r = 6.0;
  r += ctx.result * 0.25;
  r += p.goals * 1.0 + p.assists * 0.7;
  const shots = num(s.totalShots);
  const sot = Math.min(num(s.shotsOnTarget), shots || num(s.shotsOnTarget));
  r += sot * 0.15 + Math.max(0, shots - sot) * 0.03;
  r -= p.yellow * 0.3 + p.red * 1.5 + num(s.ownGoals) * 1.0;
  r -= Math.max(0, num(s.foulsCommitted) - 2) * 0.1;
  r += Math.min(num(s.foulsSuffered), 4) * 0.04;
  r -= Math.min(num(s.offsides), 3) * 0.05;

  const cleanSheet = ctx.conceded === 0 && p.minutes >= 60;
  if (p.group === 'GK') {
    r += num(s.saves) * 0.25;
    r -= num(s.goalsConceded || ctx.conceded) * 0.3;
    if (cleanSheet) r += 0.6;
  } else if (p.group === 'DEF') {
    if (cleanSheet) r += 0.5;
    r -= Math.min(ctx.conceded, 3) * 0.12;
  } else if (p.group === 'MID') {
    if (cleanSheet) r += 0.2;
  }

  // pemain yang main sebentar: rating ditarik ke 6,0
  if (p.minutes < 90) r = 6 + (r - 6) * clamp(p.minutes / 90, 0.4, 1);
  return round1(clamp(r, 3, 10));
}

function rawIndex(summary: any, teamId: string): Map<string, any> {
  const roster = (summary?.rosters ?? []).find((r: any) => String(r?.team?.id) === teamId);
  const map = new Map<string, any>();
  for (const p of roster?.roster ?? []) {
    const a = p?.athlete ?? {};
    map.set(String(a.id ?? p?.id ?? a.displayName ?? ''), p);
  }
  return map;
}

function coachOf(summary: any, teamId: string): { name: string; photo: string } | null {
  const roster = (summary?.rosters ?? []).find((r: any) => String(r?.team?.id) === teamId);
  const c = roster?.coach?.[0] ?? roster?.coach ?? null;
  const name = String(c?.displayName ?? [c?.firstName, c?.lastName].filter(Boolean).join(' ') ?? '').trim();
  if (!name) return null;
  return { name, photo: String(c?.headshot?.href ?? c?.headshot ?? '') };
}

interface FmCtx {
  fm: FmMatch | null;
  squad: FmPlayer[];
  official: boolean;
}

function buildTeam(summary: any, m: LiveMatch, side: 'home' | 'away', fx: FmCtx): RatedTeam {
  const t = m[side];
  const other = m[side === 'home' ? 'away' : 'home'];
  const lineup = m.lineups[side];
  const raw = rawIndex(summary, t.id);
  const ctx: Ctx = { result: Math.sign(t.score - other.score), conceded: other.score };
  const timeline = m.timeline.filter((x) => x.side === side);

  const rate = (lp: LineupPlayer, starter: boolean): RatedPlayer => {
    const r = raw.get(lp.id) ?? raw.get(lp.name);
    const stats: Record<string, number> = {};
    for (const s of r?.stats ?? []) if (s?.name) stats[s.name] = num(s.value);

    const played = starter || Boolean(lp.subOn) || r?.subbedIn === true;
    const on = minuteNum(lp.subOn);
    const off = minuteNum(lp.subOff);
    const minutes = !played ? 0 : starter ? clamp(off ?? 90, 1, 130) : clamp((off ?? 90) - (on ?? 70), 1, 130);

    const assists = Math.max(
      num(stats.goalAssists),
      timeline.filter((x) => (x.kind === 'goal' || x.kind === 'pen-goal') && sameName(x.related, lp.name)).length
    );
    const abbr = lp.position || String(r?.position?.abbreviation ?? '');
    // Cadangan di ESPN sering berposisi "SUB"; anggap gelandang supaya tidak dapat bonus/penalti posisi
    const group: PosGroup = !abbr || /^SUB$/i.test(abbr) ? 'MID' : groupOf(abbr);
    const fmHit = findPlayer(lp.name, fx.fm?.[side] ?? []);
    const photoHit = fmHit ?? (t.isJuve ? findPlayer(lp.name, fx.squad) : null);
    const rating = fx.official
      ? played
        ? fmHit?.rating ?? null
        : null
      : played
        ? estimate({ group, minutes, stats, goals: lp.goals, assists, yellow: lp.yellow, red: lp.red }, ctx)
        : null;

    return {
      id: lp.id,
      name: lp.name,
      jersey: lp.jersey,
      position: lp.position,
      rating,
      goals: lp.goals,
      assists,
      yellow: lp.yellow,
      red: lp.red,
      subOn: lp.subOn,
      subOff: lp.subOff,
      photo: photoHit?.photo || String(r?.athlete?.headshot?.href ?? r?.athlete?.headshot ?? ''),
      minutes,
      best: false,
    };
  };

  const starters = (lineup?.starters ?? []).map((p) => rate(p, true));
  const subs = (lineup?.subs ?? []).map((p) => rate(p, false));
  // Yang masuk lapangan dulu, lalu urut nomor punggung
  subs.sort((a, b) => Number(b.rating !== null) - Number(a.rating !== null) || (Number(a.jersey) || 99) - (Number(b.jersey) || 99));

  const formation = lineup?.formation ?? '';
  const rows = layoutRows(starters, formation, t.isJuve);

  const rated = [...starters, ...subs].filter((p) => p.rating !== null) as (RatedPlayer & { rating: number })[];
  const avg = rated.length ? round1(rated.reduce((a, p) => a + p.rating, 0) / rated.length) : null;

  return {
    teamId: t.id,
    name: t.name,
    logo: t.logo,
    isJuve: t.isJuve,
    formation,
    avg,
    coach: coachOf(summary, t.id),
    rows,
    subs,
  };
}

/** Susun 11 pemain menjadi baris-baris mengikuti posisi & formasi ESPN (lihat lib/pitch.ts). */
function layoutRows(starters: RatedPlayer[], formation: string, topTeam: boolean): RatedPlayer[][] {
  // Tim yang menyerang ke bawah (di atas) menghadap penonton: kanan tim ada di kiri layar.
  return layoutLines(starters, formation, topTeam);
}

export function buildRatings(summary: any, m: LiveMatch, fm: FmMatch | null, squad: FmPlayer[]): RatingResponse {
  // Pakai rating resmi FotMob kalau datanya ada; kalau tidak, perkirakan sendiri dari statistik ESPN.
  const official = [...(fm?.home ?? []), ...(fm?.away ?? [])].filter((p) => p.rating !== null).length >= 8;
  const fx: FmCtx = { fm, squad, official };
  const home = buildTeam(summary, m, 'home', fx);
  const away = buildTeam(summary, m, 'away', fx);

  let best: RatingResponse['best'] = null;
  for (const team of [home, away]) {
    for (const p of [...team.rows.flat(), ...team.subs]) {
      if (p.rating === null) continue;
      const cur = best?.player;
      if (!cur || p.rating > (cur.rating ?? 0) || (p.rating === cur.rating && p.goals + p.assists > cur.goals + cur.assists)) {
        best = { player: p, team: team.name, teamLogo: team.logo };
      }
    }
  }
  if (best) best.player.best = true;

  return {
    id: m.id,
    competition: m.competition,
    dateLabel: m.dateLabel,
    home,
    away,
    score: { home: m.home.score, away: m.away.score },
    source: official ? 'fotmob' : 'estimate',
    best,
  };
}
