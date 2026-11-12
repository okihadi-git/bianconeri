// Mengambil klasemen dan hasil laga ESPN lalu menjalankan simulasi sisa musim (lib/peluang.ts).
// Sisa laga = liga ganda penuh dikurangi pasangan (kandang, tamu) yang sudah selesai, jadi jadwal ke depan tidak diperlukan.
import { ESPN_BASE, fetchLeagueEvents, isCompleted, seasonStart, toNum } from './espn';
import { remainingPairs, simulate } from './peluang';

export interface PeluangTeam {
  id: string;
  name: string;
  logo: string;
  position: number;
  points: number;
  played: number;
  proj: number;
  title: number;
  ucl: number;
  rel: number;
  dist: number[];
  mostLikely: number;
}

export interface PeluangResponse {
  league: string;
  sims: number;
  /** laga yang disimulasikan */
  remaining: number;
  /** laga yang sudah dimainkan */
  playedMatches: number;
  teams: PeluangTeam[];
  warnings: string[];
  updatedAt: string;
}

const CONFIG: Record<string, { ucl: number; relegation: number }> = { 'ita.1': { ucl: 4, relegation: 3 } };
const SIMS = 10_000;
const cache = new Map<string, { at: number; sig: string; body: PeluangResponse }>();

export interface SeasonRow {
  id: string;
  name: string;
  logo: string;
  position: number;
  points: number;
  played: number;
  gf: number;
  ga: number;
  gd: number;
}

export interface Season {
  rows: SeasonRow[];
  /** semua laga musim ini (selesai dan belum) dari ESPN */
  events: any[];
  /** pasangan (kandang, tamu) yang sudah selesai */
  done: [string, string][];
  muHome: number;
  muAway: number;
  now: Date;
}

/** Klasemen + seluruh laga musim ini + rata-rata gol liga. Dipakai tab Peluang juara dan Perebutan gelar. */
export async function loadSeason(league: string): Promise<Season | null> {
  const now = new Date();
  const end = new Date(Date.UTC(seasonStart().getUTCFullYear() + 1, 5, 30));
  const [res, events] = await Promise.all([
    fetch(`${ESPN_BASE}/v2/sports/soccer/${league}/standings`, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(15_000) }).catch(() => null),
    fetchLeagueEvents(league, seasonStart(), end).catch(() => [] as any[]),
  ]);
  if (!res?.ok) return null;
  const data = await res.json();
  const entries: any[] = data?.children?.flatMap((g: any) => g?.standings?.entries ?? []) ?? data?.standings?.entries ?? [];
  const rows: SeasonRow[] = entries
    .map((e) => {
      const stat = (name: string) => Number((e.stats ?? []).find((s: any) => s.name === name)?.value ?? 0);
      return {
        id: String(e.team?.id ?? ''),
        name: String(e.team?.displayName ?? e.team?.name ?? ''),
        logo: String(e.team?.logos?.[0]?.href ?? ''),
        position: stat('rank'),
        points: stat('points'),
        played: stat('gamesPlayed'),
        gf: stat('pointsFor'),
        ga: stat('pointsAgainst'),
        gd: stat('pointDifferential'),
      };
    })
    .filter((r) => r.id);
  if (rows.length < 8) return null;

  const done: [string, string][] = [];
  let hg = 0;
  let ag = 0;
  for (const e of events.filter(isCompleted)) {
    const comps: any[] = e?.competitions?.[0]?.competitors ?? [];
    const h = comps.find((c) => c.homeAway === 'home');
    const a = comps.find((c) => c.homeAway === 'away');
    if (!h || !a) continue;
    done.push([String(h.team?.id), String(a.team?.id)]);
    hg += toNum(h.score);
    ag += toNum(a.score);
  }
  return { rows, events, done, muHome: done.length >= 20 ? hg / done.length : 1.45, muAway: done.length >= 20 ? ag / done.length : 1.15, now };
}

export async function fetchPeluang(league = 'ita.1'): Promise<PeluangResponse | null> {
  const cfg = CONFIG[league];
  if (!cfg) return null;

  const season = await loadSeason(league);
  if (!season) return null;
  const { rows, done, muHome, muAway, now } = season;

  const sig = `${league}:${rows.reduce((n, r) => n + r.played, 0)}:${rows.reduce((n, r) => n + r.points, 0)}`;
  const hit = cache.get(league);
  if (hit && hit.sig === sig && now.getTime() - hit.at < 15 * 60_000) return hit.body;

  const ids = rows.map((r) => r.id);
  const remaining = remainingPairs(ids, done);
  const warnings: string[] = [];
  // pemeriksaan: sisa laga tiap klub harus cocok dengan klasemen (2 × (n−1) − laga main)
  const expected = new Map(rows.map((r) => [r.id, 2 * (rows.length - 1) - r.played]));
  const actual = new Map<string, number>();
  for (const [h, a] of remaining) {
    actual.set(h, (actual.get(h) ?? 0) + 1);
    actual.set(a, (actual.get(a) ?? 0) + 1);
  }
  const off = rows.filter((r) => (actual.get(r.id) ?? 0) !== expected.get(r.id)).length;
  if (off) warnings.push(`Data laga ESPN tidak sepenuhnya cocok dengan klasemen (${off} klub), jadi sisa laga bisa kurang akurat.`);

  const sim = simulate({ teams: rows, remaining, muHome, muAway, sims: SIMS, seed: sig.split('').reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7), ucl: cfg.ucl, relegation: cfg.relegation });
  const byId = new Map(sim.map((s) => [s.id, s]));
  const teams: PeluangTeam[] = rows
    .map((r) => {
      const s = byId.get(r.id)!;
      return { id: r.id, name: r.name, logo: r.logo, position: r.position, points: r.points, played: r.played, proj: s.proj, title: s.title, ucl: s.ucl, rel: s.rel, dist: s.dist, mostLikely: s.mostLikely };
    })
    .sort((a, b) => (a.position || 99) - (b.position || 99) || b.points - a.points);

  const body: PeluangResponse = { league, sims: SIMS, remaining: remaining.length, playedMatches: done.length, teams, warnings, updatedAt: now.toISOString() };
  cache.set(league, { at: now.getTime(), sig, body });
  return body;
}
