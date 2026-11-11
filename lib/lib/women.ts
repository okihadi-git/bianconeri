// Juventus Women: klasemen liga + jadwal & hasil (liga, Liga Champions Wanita, piala).
//   Sumber utama : FotMob, halaman tim Juventus (W) — memuat tabel Serie A Femminile dan seluruh jadwal/hasil semua kompetisi.
//   Cadangan     : ESPN (slug kompetisi putri di ESPN tidak terdokumentasi dan sering tidak ada, jadi hanya dipakai bila FotMob gagal).
// Tidak melempar error: data yang tidak ada bernilai kosong + peringatan; `sources` menjelaskan dari mana data berasal.
import { ESPN_BASE, addDays, fetchLeagueEvents, eventState, toNum } from './espn';
import { parseFotmob } from './squad';
import type { SquadPlayer } from './types';

export type WomenKind = 'liga' | 'eropa' | 'piala' | 'lain';

const CANDIDATES: Record<Exclude<WomenKind, 'lain'>, { slugs: string[]; name: string; short: string; match: (slug: string) => boolean }> = {
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
  /** nama kompetisi apa adanya dari sumber (mis. "Serie C Grp. B") */
  tournament?: string;
}

export interface WTransfer {
  id: string;
  name: string;
  /** klub asal (untuk masuk) atau klub tujuan (untuk keluar) */
  club: string;
  loan: boolean;
  iso: string;
}

export interface WomenResponse {
  /** skuad tim utama (FotMob); kosong bila tidak tersedia */
  squad: SquadPlayer[];
  info: { coach: string; captain: string; venue: string; competitions: string[] } | null;
  transfers: { label: string; in: WTransfer[]; out: WTransfer[] } | null;
  team: { id: string; name: string; logo: string } | null;
  league: { slug: string; name: string; season: string } | null;
  standings: WStandingRow[];
  matches: WMatch[];
  /** asal data: FotMob (utama) atau ESPN (cadangan) */
  source: 'fotmob' | 'espn' | null;
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
export function candidateSlugs(kind: Exclude<WomenKind, 'lain'>, discovered: string[]): string[] {
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

export function parseMatch(e: any, kind: Exclude<WomenKind, 'lain'>, teamId: string): WMatch | null {
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
    comp: CANDIDATES[kind as Exclude<WomenKind, 'lain'>].short,
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

export async function fetchWomenEspn(now = new Date()): Promise<WomenResponse> {
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

  return { squad: [], info: null, transfers: null, team, league, standings, matches, source: matches.length || standings.length ? 'espn' : null, sources, warnings, updatedAt: now.toISOString() };
}

/* ---------- FotMob (sumber utama) ---------- */

export const FOTMOB_WOMEN_TEAM_ID = process.env.FOTMOB_WOMEN_TEAM_ID || '956623'; // Juventus (W)
const fmLogo = (id: unknown) => (id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : '');
const cleanTeam = (n: string) => n.replace(/\s*\(W\)\s*$/i, '').trim();

const FM_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; bianconeri-matchday-hub)',
};

/** Cari semua node laga (punya id, status.utcTime, home/away) di mana pun dalam payload; urutan/lokasi field FotMob bisa berubah. */
export function collectFixtures(data: any): any[] {
  const out = new Map<string, any>();
  const walk = (n: any, depth: number) => {
    if (!n || typeof n !== 'object' || depth > 9) return;
    if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1));
    if (n.id != null && n.status?.utcTime && n.home && n.away) {
      out.set(String(n.id), n);
      return;
    }
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(data, 0);
  return [...out.values()];
}

/** Cari tabel liga: larik objek yang punya name, played, pts. Memilih yang memuat Juventus bila ada beberapa tabel. */
export function findTable(data: any, prefer?: RegExp): { rows: any[]; leagueName: string } | null {
  const found: { rows: any[]; leagueName: string }[] = [];
  const walk = (n: any, depth: number, leagueName: string) => {
    if (!n || typeof n !== 'object' || depth > 10) return;
    if (Array.isArray(n)) {
      if (n.length >= 4 && n.every((r) => r && typeof r === 'object' && 'pts' in r && 'played' in r && r.name != null)) found.push({ rows: n, leagueName });
      else n.forEach((x) => walk(x, depth + 1, leagueName));
      return;
    }
    const name = typeof n.leagueName === 'string' ? n.leagueName : leagueName;
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v, depth + 1, name);
  };
  walk(data, 0, '');
  const mine = found.filter((f) => f.rows.some((r) => isJuveName(String(r.name)) || String(r.id) === FOTMOB_WOMEN_TEAM_ID || /juventus/i.test(String(r.name))));
  return (prefer && mine.find((f) => prefer.test(f.leagueName))) || mine[0] || found[0] || null;
}

export function parseFotmobTable(data: any, teamId: string, prefer?: RegExp): { rows: WStandingRow[]; name: string } {
  const t = findTable(data, prefer);
  if (!t) return { rows: [], name: '' };
  const rows: WStandingRow[] = t.rows.map((r, i) => {
    const [gf, ga] = String(r.scoresStr ?? '').split('-').map((x) => Number(x.trim()));
    const name = cleanTeam(String(r.name ?? r.shortName ?? 'Tim'));
    const diff = Number(r.goalConDiff);
    return {
      id: String(r.id ?? name),
      name,
      logo: fmLogo(r.id),
      position: Number(r.idx) || i + 1,
      played: Number(r.played) || 0,
      won: Number(r.wins) || 0,
      draw: Number(r.draws) || 0,
      lost: Number(r.losses) || 0,
      goalsFor: Number.isFinite(gf) ? gf : 0,
      goalsAgainst: Number.isFinite(ga) ? ga : 0,
      goalDiff: Number.isFinite(diff) ? diff : (Number.isFinite(gf) && Number.isFinite(ga) ? gf - ga : 0),
      points: Number(r.pts) || 0,
      isJuve: String(r.id) === teamId || isJuveName(name),
    };
  });
  rows.sort((a, b) => a.position - b.position);
  return { rows, name: t.leagueName };
}

function kindOf(tournament: string): { kind: WomenKind; comp: string } {
  if (/champions/i.test(tournament)) return { kind: 'eropa', comp: 'UWCL' };
  if (/coppa|cup|pokal/i.test(tournament)) return { kind: 'piala', comp: 'COPPA' };
  if (/serie a/i.test(tournament)) return { kind: 'liga', comp: 'SERIE A' };
  return { kind: 'lain', comp: tournament.replace(/women'?s?/i, '').trim().slice(0, 8).toUpperCase() || 'LAIN' };
}

export function parseFotmobMatch(f: any, teamId: string): WMatch | null {
  const t = new Date(f?.status?.utcTime ?? '').getTime();
  if (!Number.isFinite(t)) return null;
  const homeIsUs = String(f.home?.id) === teamId || (String(f.away?.id) !== teamId && isJuveName(String(f.home?.name ?? '')));
  const awayIsUs = String(f.away?.id) === teamId || (!homeIsUs && isJuveName(String(f.away?.name ?? '')));
  if (!homeIsUs && !awayIsUs) return null;
  const them = homeIsUs ? f.away : f.home;

  const st = f.status ?? {};
  if (st.cancelled) return null;
  const status: WMatch['status'] = st.finished ? 'post' : st.started ? 'live' : 'pre';

  let score: WMatch['score'] = null;
  if (status !== 'pre') {
    const m = /(\d+)\s*-\s*(\d+)/.exec(String(st.scoreStr ?? ''));
    const h = m ? Number(m[1]) : Number(f.home?.score);
    const a = m ? Number(m[2]) : Number(f.away?.score);
    if (Number.isFinite(h) && Number.isFinite(a)) score = homeIsUs ? { us: h, them: a } : { us: a, them: h };
  }
  const result: WMatch['result'] = status !== 'post' || !score ? null : score.us > score.them ? 'W' : score.us < score.them ? 'L' : 'D';
  const tournament = String(f.tournament?.name ?? f.tournament?.shortName ?? f.leagueName ?? '');
  const { kind, comp } = kindOf(tournament);
  return {
    id: String(f.id),
    kind,
    comp,
    iso: new Date(t).toISOString(),
    venue: '',
    status,
    home: homeIsUs,
    opponent: cleanTeam(String(them?.name ?? them?.longName ?? 'TBA')),
    opponentLogo: fmLogo(them?.id),
    score,
    result,
    round: String(st.reason?.long ?? ''),
    tournament,
  };
}

/** Nama kapten dari penanda isCaptain pada anggota skuad FotMob (kosong bila FotMob tidak menandainya). */
export function parseCaptain(data: any): string {
  for (const g of data?.squad?.squad ?? []) for (const m of g?.members ?? []) if (m?.isCaptain === true && m?.name) return String(m.name);
  return '';
}

/** Nama stadion kandang bila FotMob menyertakannya di data tim. */
export function parseVenue(data: any): string {
  const v = data?.overview?.venue?.name ?? data?.overview?.venue?.widget?.name ?? data?.details?.sportsTeamJSONLD?.location?.name ?? data?.venue?.name ?? '';
  return typeof v === 'string' ? v.trim() : '';
}

const isoOf = (v: unknown): string | null => {
  const t = new Date(String(v ?? '')).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/**
 * Transfer musim ini dari data tim FotMob (larik berisi playerId + fromClub/toClub, di mana pun posisinya).
 * Masuk = klub tujuan Juventus (W), keluar = klub asal Juventus (W). Hanya yang sejak 1 Juni musim berjalan.
 */
export function parseTransfers(data: any, teamId: string, now: Date): WomenResponse['transfers'] {
  const items = new Map<string, any>();
  const walk = (n: any, depth: number) => {
    if (!n || typeof n !== 'object' || depth > 9) return;
    if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1));
    if (n.playerId != null && n.name && ('fromClub' in n || 'toClub' in n)) {
      items.set(`${n.playerId}|${n.transferDate}|${n.fromClub}|${n.toClub}`, n);
      return;
    }
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(data?.transfers ?? data, 0);
  if (!items.size) return null;

  const seasonEnd = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const start = Date.UTC(seasonEnd - 1, 5, 1);
  const end = now.getTime() + 60 * 86400000;
  const inn: WTransfer[] = [];
  const out: WTransfer[] = [];
  for (const t of items.values()) {
    const iso = isoOf(t.transferDate);
    if (!iso || new Date(iso).getTime() < start || new Date(iso).getTime() > end) continue;
    const to = String(t.toClub ?? '');
    const from = String(t.fromClub ?? '');
    const toUs = String(t.toClubId) === teamId || isJuveName(to);
    const fromUs = String(t.fromClubId) === teamId || isJuveName(from);
    const loan = Boolean(t.onLoan) || /loan/i.test(String(t.transferType?.text ?? t.transferText ?? ''));
    const base = { id: String(t.playerId), name: String(t.name), loan, iso };
    if (toUs && !fromUs) inn.push({ ...base, club: cleanTeam(from) || 'tanpa klub' });
    else if (fromUs && !toUs) out.push({ ...base, club: cleanTeam(to) || 'tanpa klub' });
  }
  if (!inn.length && !out.length) return null;
  const byDate = (a: WTransfer, b: WTransfer) => b.iso.localeCompare(a.iso) || a.name.localeCompare(b.name);
  inn.sort(byDate);
  out.sort(byDate);
  // semua di jendela musim panas (Jun–Sep) → "musim panas"; bila ada yang lebih lambat (mis. Januari) → "musim ini"
  const summerOnly = [...inn, ...out].every((t) => [5, 6, 7, 8].includes(new Date(t.iso).getUTCMonth()));
  return { label: summerOnly ? `musim panas ${seasonEnd - 1}` : 'musim ini', in: inn, out };
}

const GROUP_ORDER = ['Kiper', 'Bek', 'Gelandang', 'Penyerang', 'Lainnya'];

/** null = FotMob tidak bisa dihubungi / tidak memuat data apa pun. */
export async function fetchWomenFotmob(now = new Date()): Promise<WomenResponse | null> {
  let data: any = null;
  try {
    const res = await fetch(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_WOMEN_TEAM_ID}&ccode3=IDN`, { headers: FM_HEADERS, next: { revalidate: 900 }, signal: AbortSignal.timeout(12000) });
    data = res.ok ? await res.json() : null;
  } catch {
    data = null;
  }
  if (!data) return null;

  const teamId = FOTMOB_WOMEN_TEAM_ID;
  const table = parseFotmobTable(data, teamId);
  const from = now.getTime() - 100 * 86400000;
  const to = now.getTime() + 150 * 86400000;
  const matches = collectFixtures(data)
    .map((f) => parseFotmobMatch(f, teamId))
    .filter((m): m is WMatch => m !== null && new Date(m.iso).getTime() >= from && new Date(m.iso).getTime() <= to)
    .sort((a, b) => a.iso.localeCompare(b.iso));
  if (!table.rows.length && !matches.length) return null;

  const juve = table.rows.find((r) => r.isJuve) ?? null;
  const count = (k: WomenKind) => matches.filter((m) => m.kind === k).length;
  const slug = `fotmob:${teamId}`;
  const warnings: string[] = [];
  if (!table.rows.length) warnings.push('Tabel liga tidak ditemukan di data FotMob; jadwal dan hasil tetap ditampilkan.');
  if (!matches.length) warnings.push('Jadwal dan hasil tidak ditemukan di data FotMob.');

  const sq = parseFotmob(data);
  const squad = [...sq.players].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || (Number(a.jersey) || 999) - (Number(b.jersey) || 999) || a.name.localeCompare(b.name));
  const comps = [count('liga') ? 'Serie A Women' : '', count('eropa') ? 'Liga Champions Wanita' : '', count('piala') ? 'Coppa Italia Women' : ''].filter(Boolean);
  const transfers = parseTransfers(data, teamId, now);

  return {
    squad,
    info: { coach: sq.coach, captain: parseCaptain(data), venue: parseVenue(data), competitions: comps },
    transfers,
    team: { id: teamId, name: juve?.name ?? 'Juventus', logo: fmLogo(teamId) },
    league: table.rows.length ? { slug, name: 'Serie A Women', season: seasonLabel(now) } : null,
    standings: table.rows,
    matches,
    source: 'fotmob',
    sources: [
      { kind: 'liga', name: table.name || 'Serie A Femminile', slug, events: count('liga'), standings: table.rows.length },
      { kind: 'eropa', name: 'Liga Champions Wanita', slug, events: count('eropa') },
      { kind: 'piala', name: 'Coppa Italia Women', slug, events: count('piala') },
      ...(count('lain') ? [{ kind: 'lain' as const, name: 'Lainnya', slug, events: count('lain') }] : []),
    ],
    warnings,
    updatedAt: now.toISOString(),
  };
}

/** FotMob dulu; ESPN hanya bila FotMob gagal. */
export async function fetchWomen(now = new Date()): Promise<WomenResponse> {
  const fm = await fetchWomenFotmob(now);
  if (fm) return fm;
  const espn = await fetchWomenEspn(now);
  if (espn.source) espn.warnings.unshift('FotMob tidak bisa dimuat; data memakai ESPN (cadangan).');
  else espn.warnings.unshift('FotMob dan ESPN sama-sama tidak mengembalikan data Juventus Women.');
  return espn;
}
