// Performa pemain akademi satu musim: menjumlahkan semua laga selesai tim (lineup + kejadian) dari FotMob `matchDetails`.
//   main/starter/menit : lineup (timeSubbedOn / timeSubbedOut) — laga tanpa data pergantian dihitung 90′ untuk starter
//   gol/assist/kartu    : kejadian laga (matchFacts.events) bila ada, cadangan dari performance.events pada lineup
//   rating              : rata-rata rating FotMob per laga (butuh ≥ 2 laga berating)
// Format `matchDetails` tidak terdokumentasi dan liga kecil sering tanpa rating/kejadian, jadi parser longgar dan setiap
// kekosongan dicatat di `coverage` (jumlah laga yang punya lineup/kejadian/rating) — tidak ada angka karangan.
import { fotmobPhoto } from './squad';
import { normName } from './names';
import { collectFixtures } from './women';

export interface PerfRow {
  id: string;
  name: string;
  photo: string;
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  /** rata-rata rating FotMob; null bila kurang dari 2 laga berating */
  rating: number | null;
  ratedMatches: number;
}

export interface PerfResponse {
  rows: PerfRow[];
  coverage: { found: number; fetched: number; withLineup: number; withEvents: number; withRatings: number };
  asOf: string;
  warnings: string[];
}

interface Acc {
  id: string;
  name: string;
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  ratings: number[];
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

function nameOf(n: any): string {
  const nm = n?.name;
  if (typeof nm === 'string') return nm.trim();
  return String(nm?.fullName ?? ([nm?.firstName, nm?.lastName].filter(Boolean).join(' ') || n?.fullName || n?.shortName || '')).trim();
}

const ratingOf = (n: any): number | null => {
  const r = num(n?.performance?.rating ?? n?.rating?.num ?? (typeof n?.rating === 'number' || typeof n?.rating === 'string' ? n.rating : null));
  return r != null && r > 0 ? r : null;
};

function sideNodes(lineup: any, side: 'home' | 'away'): { starters: any[]; subs: any[] } {
  const t = lineup?.[side === 'home' ? 'homeTeam' : 'awayTeam'] ?? (Array.isArray(lineup) ? lineup[side === 'home' ? 0 : 1] : null);
  const starters = Array.isArray(t?.starters) ? t.starters : Array.isArray(t?.lineup) ? t.lineup.flat?.() ?? [] : [];
  const subs = Array.isArray(t?.subs) ? t.subs : Array.isArray(t?.bench) ? t.bench : [];
  return { starters, subs };
}

/** Menit bermain dari data pergantian; null = tidak bisa dihitung. */
function minutesOf(n: any, starter: boolean): number | null {
  let on = num(n?.timeSubbedOn);
  let off = num(n?.timeSubbedOut);
  const evs: any[] = Array.isArray(n?.performance?.substitutionEvents) ? n.performance.substitutionEvents : [];
  for (const e of evs) {
    const t = num(e?.time);
    if (t == null) continue;
    if (/in|on/i.test(String(e?.type ?? ''))) on = on ?? t;
    else if (/out|off/i.test(String(e?.type ?? ''))) off = off ?? t;
  }
  if (starter) return Math.max(1, (off ?? 90) - 0);
  if (on == null) return null;
  return Math.max(1, (off ?? 90) - on);
}

function eventsOf(detail: any): any[] {
  const e = detail?.content?.matchFacts?.events?.events;
  return Array.isArray(e) ? e : [];
}

/** Tambahkan satu laga ke akumulator. Mengembalikan petunjuk kelengkapan data laga ini. */
export function aggregateMatch(detail: any, side: 'home' | 'away', acc: Map<string, Acc>): { lineup: boolean; events: boolean; ratings: boolean } {
  const { starters, subs } = sideNodes(detail?.content?.lineup, side);
  if (!starters.length && !subs.length) return { lineup: false, events: false, ratings: false };

  const ids = new Set<string>();
  const byName = new Map<string, string>();
  const touch = (n: any, starter: boolean): Acc | null => {
    const id = String(n?.id ?? n?.playerId ?? '');
    const name = nameOf(n);
    if (!id || !name) return null;
    ids.add(id);
    byName.set(normName(name).join(' '), id);
    const a = acc.get(id) ?? { id, name, apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, ratings: [] };
    acc.set(id, a);
    return a;
  };

  let anyRating = false;
  for (const [list, starter] of [[starters, true], [subs, false]] as const) {
    for (const n of list) {
      const a = touch(n, starter);
      if (!a) continue;
      const m = minutesOf(n, starter);
      const r = ratingOf(n);
      // cadangan tanpa data pergantian dan tanpa rating = tidak bermain
      if (!starter && m == null && r == null) continue;
      a.apps += 1;
      if (starter) a.starts += 1;
      a.minutes += m ?? 0;
      if (r != null) {
        a.ratings.push(r);
        anyRating = true;
      }
    }
  }

  // gol / assist / kartu
  const evs = eventsOf(detail);
  let usedEvents = false;
  const pid = (e: any) => String(e?.player?.id ?? e?.playerId ?? '');
  for (const e of evs) {
    const isHome = e?.isHome;
    const mine = isHome == null ? ids.has(pid(e)) : isHome === (side === 'home');
    if (!mine) continue;
    const type = String(e?.type ?? '').toLowerCase();
    const p = acc.get(pid(e));
    if (type === 'goal') {
      const own = e?.ownGoal === true || /own/i.test(String(e?.eventType ?? e?.goalDescription ?? ''));
      if (p && !own) p.goals += 1;
      const aid = String(e?.assistPlayerId ?? e?.assistPlayer?.id ?? (e?.assistStr ? byName.get(normName(String(e.assistStr)).join(' ')) ?? '' : ''));
      const asst = aid ? acc.get(aid) : undefined;
      if (asst && !own && ids.has(aid)) asst.assists += 1;
      usedEvents = usedEvents || Boolean(p);
    } else if (type === 'card') {
      const c = String(e?.card ?? e?.cardType ?? '').toLowerCase();
      if (!p) continue;
      if (/red/.test(c) && !/yellow/.test(c)) p.red += 1;
      else if (/yellow.?red|second/.test(c)) {
        p.yellow += 1;
        p.red += 1;
      } else if (/yellow/.test(c)) p.yellow += 1;
      usedEvents = true;
    }
  }
  return { lineup: true, events: evs.length > 0 && usedEvents, ratings: anyRating };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function toRows(acc: Map<string, Acc>): PerfRow[] {
  return [...acc.values()]
    .filter((a) => a.apps > 0)
    .map((a) => ({
      id: a.id,
      name: a.name,
      photo: fotmobPhoto(a.id),
      apps: a.apps,
      starts: a.starts,
      minutes: a.minutes,
      goals: a.goals,
      assists: a.assists,
      yellow: a.yellow,
      red: a.red,
      rating: a.ratings.length >= 2 ? round1(a.ratings.reduce((x, y) => x + y, 0) / a.ratings.length) : null,
      ratedMatches: a.ratings.length,
    }))
    .sort((x, y) => y.minutes - x.minutes || y.goals - x.goals || x.name.localeCompare(y.name));
}

/* ---------- pengambilan ---------- */

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; bianconeri-matchday-hub)',
};

async function fm(path: string, revalidate: number): Promise<any | null> {
  try {
    const res = await fetch(`https://www.fotmob.com/api/data/${path}`, { headers: HEADERS, next: { revalidate }, signal: AbortSignal.timeout(12000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

/** Laga selesai tim ini sejak 1 Juli musim berjalan (maksimal 60 laga). */
export function seasonFixtures(teamData: any, teamId: string, now: Date): { id: string; side: 'home' | 'away' }[] {
  const seasonStart = Date.UTC(now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1, 6, 1);
  return collectFixtures(teamData)
    .filter((f) => f?.status?.finished && !f?.status?.cancelled && new Date(f.status.utcTime).getTime() >= seasonStart)
    .map((f) => ({ id: String(f.id), side: String(f.home?.id) === teamId ? ('home' as const) : String(f.away?.id) === teamId ? ('away' as const) : null }))
    .filter((f): f is { id: string; side: 'home' | 'away' } => f.side !== null)
    .slice(0, 60);
}

export async function fetchPerformance(teamId: string, now = new Date()): Promise<PerfResponse | null> {
  const team = await fm(`teams?id=${teamId}&ccode3=IDN`, 900);
  if (!team) return null;
  const fixtures = seasonFixtures(team, teamId, now);
  const details = await mapLimit(fixtures, 6, (f) => fm(`matchDetails?matchId=${encodeURIComponent(f.id)}`, 21600)); // laga selesai tidak berubah: cache 6 jam

  const acc = new Map<string, Acc>();
  const cov = { found: fixtures.length, fetched: 0, withLineup: 0, withEvents: 0, withRatings: 0 };
  details.forEach((d, i) => {
    if (!d) return;
    cov.fetched += 1;
    const r = aggregateMatch(d, fixtures[i].side, acc);
    if (r.lineup) cov.withLineup += 1;
    if (r.events) cov.withEvents += 1;
    if (r.ratings) cov.withRatings += 1;
  });

  const warnings: string[] = [];
  if (!cov.found) warnings.push('Belum ada laga selesai musim ini di data FotMob.');
  else if (!cov.fetched) warnings.push('Detail laga tidak bisa dimuat dari FotMob.');
  else if (!cov.withLineup) warnings.push('FotMob tidak menyediakan susunan pemain untuk laga tim ini.');
  else {
    if (!cov.withEvents) warnings.push('Gol, assist, dan kartu tidak ditemukan di data laga FotMob; kolomnya tampil 0.');
    if (!cov.withRatings) warnings.push('Rating pemain tidak tersedia untuk kompetisi ini di FotMob.');
  }
  return { rows: toRows(acc), coverage: cov, asOf: now.toISOString(), warnings };
}
