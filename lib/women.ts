// Juventus Women: klasemen liga + jadwal & hasil (liga, Liga Champions Wanita, piala) dari ESPN.
// Slug ESPN untuk kompetisi putri tidak terdokumentasi, jadi dicoba beberapa kandidat (plus penemuan otomatis dari daftar
// liga ESPN) dan dipakai yang benar-benar memuat Juventus. Slug yang dipakai & jumlah laga tiap kompetisi dikembalikan di
// `sources` supaya mudah dilacak. Tidak melempar error: data yang tidak ada bernilai kosong + peringatan.
import { ESPN_BASE, addDays, fetchLeagueEvents, eventState, toNum } from './espn';

export type WomenKind = 'liga' | 'eropa' | 'piala';

const CANDIDATES: Record<WomenKind, { slugs: string[]; name: string; short: string; match: (slug: string) => boolean }> = {
  liga: {
    slugs: ['ita.w.1', 'ita.w.serie_a', 'ita.1.w'],
    name: 'Serie A Women',
    short: 'SERIE A',
    match: (s) => /^ita\./.test(s) && /(^|\.)w(\.|$)|women|femm/.test(s) && !/coppa|cup|super/.test(s),
  },
  eropa: {
    slugs: ['uefa.wchampions', 'uefa.w.champions', 'uefa.womens.champions', 'uefa.wchampions_league'],
    name: 'Liga Champions Wanita',
    short: 'UWCL',
    match: (s) => /^uefa\./.test(s) && /(^|\.)w|women/.test(s) && /champ/.test(s),
  },
  piala: {
    slugs: ['ita.w.coppa_italia', 'ita.w.coppa', 'ita.coppa_italia.w'],
    name: 'Coppa Italia Women',
    short: 'COPPA',
    match: (s) => /^ita\./.test(s) && /(^|\.)w(\.|$)|women|femm/.test(s) && /coppa|cup/.test(s),
  },
};

export interface WStandingRow {
  id: string;
  name: string;
  logo: string;
  position: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  isJuve: boolean;
}

export interface WMatch {
  id: string;
  kind: WomenKind;
  /** label singkat kompetisi: SERIE A / UWCL / COPPA */
  comp: string;
  iso: string;
  venue: string;
  status: 'pre' | 'live' | 'post';
  home: boolean;
  opponent: string;
  opponentLogo: string;
  /** skor dari sudut pandang Juventus; null bila belum main */
  score: { us: number; them: number } | null;
  result: 'W' | 'D' | 'L' | null;
  round: string;
}

export interface WomenResponse {
  team: { id: string; name: string; logo: string } | null;
  league: { slug: string; name: string; season: string } | null;
  standings: WStandingRow[];
  matches: WMatch[];
  sources: { kind: WomenKind; name: string; slug: string | null; events: number; standings?: number }[];
  warnings: string[];
  updatedAt: string;
}

const isJuveName = (n: string) => /juventus/i.test(n);

/* ---------- penemuan slug ---------- */

async function discoverSlugs(): Promise<string[]> {
  try {
    const res = await fetch('https://sports.core.api.espn.com/v2/sports/soccer/leagues?limit=1000', { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data: any = await res.json();
    const refs: string[] = (data?.items ?? []).map((i: any) => String(i?.$ref ?? ''));
    return refs.map((r) => /\/leagues\/([^/?]+)/.exec(r)?.[1] ?? '').filter(Boolean);
  } catch {
    return [];
  }
}

/** Kandidat berurutan: slug bawaan yang ada di daftar ESPN lebih dulu, lalu hasil penemuan, lalu sisa bawaan. */
export function candidateSlugs(kind: WomenKind, discovered: string[]): string[] {
  const def = CANDIDATES[kind];
  const found = discovered.filter(def.match);
  const known = def.slugs.filter((s) => discovered.includes(s));
  return [...new Set([...known, ...found, ...def.slugs])];
}

/* ---------- ESPN ---------- */

/** Slug yang tidak ada dijawab HTTP 400/404 oleh ESPN; slug yang ada dijawab 200 walau tanpa laga. Dicek sekali (cache 1 hari) sebelum mengambil jadwal sebulan-sebulan. */
async function slugExists(slug: string): Promise<boolean> {
  try {
    const res = await fetch(`${ESPN_BASE}/site/v2/sports/soccer/${slug}/scoreboard?limit=1`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function getJson(url: string, revalidate: number): Promise<any | null> {
  try {
    const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(10000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function parseStandings(data: any): { rows: WStandingRow[]; name: string; season: string } {
  const entries: any[] = data?.children?.flatMap((g: any) => g?.standings?.entries ?? []) ?? data?.standings?.entries ?? [];
  const rows: WStandingRow[] = entries.map((entry) => {
    const stat = (n: string) => Number((entry.stats ?? []).find((s: any) => s.name === n)?.value ?? 0) || 0;
    const name = String(entry.team?.displayName ?? entry.team?.name ?? 'Tim');
    return {
      id: String(entry.team?.id ?? ''),
      name,
      logo: String(entry.team?.logos?.[0]?.href ?? ''),
      position: stat('rank'),
      played: stat('gamesPlayed'),
      won: stat('wins'),
      draw: stat('ties'),
      lost: stat('losses'),
      goalsFor: stat('pointsFor'),
      goalsAgainst: stat('pointsAgainst'),
      goalDiff: stat('pointDifferential'),
      points: stat('points'),
      isJuve: isJuveName(name),
    };
  });
  rows.sort((a, b) => (a.position || 999) - (b.position || 999) || b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
  rows.forEach((r, i) => {
    if (!r.position) r.position = i + 1;
  });
  const season = String(data?.season?.displayName ?? data?.seasonDisplay ?? data?.children?.[0]?.season?.displayName ?? '');
  return { rows, name: String(data?.name ?? ''), season };
}

const seasonLabel = (now: Date) => {
  const end = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  return `${end - 1}/${String(end).slice(2)}`;
};

export function parseMatch(e: any, kind: WomenKind, teamId: string): WMatch | null {
  const comp = e?.competitions?.[0];
  const cs: any[] = comp?.competitors ?? [];
  const us = cs.find((c) => teamId && String(c?.team?.id) === teamId) ?? cs.find((c) => isJuveName(String(c?.team?.displayName ?? '')));
  const them = cs.find((c) => c !== us);
  if (!us || !them) return null;
  const status = eventState(e);
  const sc = (c: any) => (status === 'pre' || c?.score == null ? null : toNum(c.score));
  const a = sc(us);
  const b = sc(them);
  const score = a != null && b != null ? { us: a, them: b } : null;
  // adu penalti/perpanjangan: pakai flag winner ESPN bila skor imbang
  const result: WMatch['result'] = status !== 'post' || !score ? null : score.us > score.them ? 'W' : score.us < score.them ? 'L' : us?.winner === true ? 'W' : them?.winner === true ? 'L' : 'D';
  return {
    id: String(e.id),
    kind,
    comp: CANDIDATES[kind].short,
    iso: new Date(e.date).toISOString(),
    venue: String(comp?.venue?.fullName ?? ''),
    status,
    home: us.homeAway === 'home',
    opponent: String(them?.team?.displayName ?? them?.team?.name ?? 'TBA'),
    opponentLogo: String(them?.team?.logos?.[0]?.href ?? them?.team?.logo ?? ''),
    score,
    result,
    round: String(comp?.notes?.[0]?.headline ?? ''),
  };
}

export async function fetchWomen(now = new Date()): Promise<WomenResponse> {
  const warnings: string[] = [];
  const sources: WomenResponse['sources'] = [];
  const discovered = await discoverSlugs();

  // 1) liga: slug pertama yang klasemennya memuat Juventus
  let league: WomenResponse['league'] = null;
  let standings: WStandingRow[] = [];
  let leagueSlug: string | null = null;
  for (const slug of candidateSlugs('liga', discovered)) {
    const data = await getJson(`${ESPN_BASE}/v2/sports/soccer/${slug}/standings`, 1800);
    if (!data) continue;
    const parsed = parseStandings(data);
    if (parsed.rows.some((r) => r.isJuve)) {
      leagueSlug = slug;
      standings = parsed.rows;
      league = { slug, name: parsed.name || CANDIDATES.liga.name, season: parsed.season || seasonLabel(now) };
      break;
    }
  }
  sources.push({ kind: 'liga', name: CANDIDATES.liga.name, slug: leagueSlug, events: 0, standings: standings.length });
  if (!league) warnings.push('Klasemen Serie A Women tidak ditemukan di ESPN (slug kompetisi putri tidak terdokumentasi). Lihat `sources` untuk slug yang dicoba.');

  const juveRow = standings.find((r) => r.isJuve) ?? null;
  let team: WomenResponse['team'] = juveRow ? { id: juveRow.id, name: juveRow.name, logo: juveRow.logo } : null;

  // 2) jadwal & hasil per kompetisi
  const from = addDays(now, -100);
  const to = addDays(now, 150);
  const matches: WMatch[] = [];
  for (const kind of ['liga', 'eropa', 'piala'] as const) {
    const slugs = kind === 'liga' ? (leagueSlug ? [leagueSlug] : candidateSlugs('liga', discovered)) : candidateSlugs(kind, discovered);
    let used: string | null = null;
    let count = 0;
    for (const slug of slugs) {
      if (!(await slugExists(slug))) continue;
      const events = await fetchLeagueEvents(slug, from, to);
      const mine = events.filter((e) => (e?.competitions?.[0]?.competitors ?? []).some((c: any) => (team && String(c?.team?.id) === team.id) || isJuveName(String(c?.team?.displayName ?? ''))));
      if (!mine.length) continue;
      used = slug;
      if (!team) {
        const c = mine[0].competitions[0].competitors.find((x: any) => isJuveName(String(x?.team?.displayName ?? '')));
        if (c) team = { id: String(c.team.id), name: String(c.team.displayName), logo: String(c.team?.logos?.[0]?.href ?? c.team?.logo ?? '') };
      }
      for (const e of mine) {
        const m = parseMatch(e, kind, team?.id ?? '');
        if (m) matches.push(m);
      }
      count = mine.length;
      break;
    }
    const src = sources.find((s) => s.kind === kind);
    if (src) {
      src.slug = used ?? src.slug;
      src.events = count;
    } else {
      sources.push({ kind, name: CANDIDATES[kind].name, slug: used, events: count });
    }
  }
  matches.sort((a, b) => a.iso.localeCompare(b.iso));
  if (!matches.length) warnings.push('Jadwal dan hasil Juventus Women tidak ditemukan di ESPN untuk 100 hari ke belakang dan 150 hari ke depan.');

  return { team, league, standings, matches, sources, warnings, updatedAt: now.toISOString() };
}
