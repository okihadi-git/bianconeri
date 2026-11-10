// Akademi Juventus: Juventus Next Gen dan pemain yang dipinjamkan — semuanya dari FotMob.
//   Tim      : /api/data/teams?id=…  (tabel liga, jadwal & hasil, skuad, top skor) — pola yang sama dengan halaman Women
//   Pinjaman : daftar transfer keluar berstatus pinjaman di data tim utama → /api/data/playerData?id=… tiap pemain
// Tidak melempar error; yang tidak ada di sumber bernilai kosong dan dijelaskan di `warnings`/`sources`.
import { FOTMOB_TEAM_ID, fotmobPhoto, parseFotmob } from './squad';
import type { SquadGroup } from './types';
import { collectFixtures, parseFotmobMatch, parseFotmobTable, parseTransfers, type WMatch, type WStandingRow } from './women';

export const FOTMOB_NEXTGEN_ID = process.env.FOTMOB_NEXTGEN_ID || '956184'; // Juventus Next Gen
export type AcademyKey = 'nextgen';

export interface AcademyTeam {
  key: AcademyKey;
  id: string;
  /** nama tim seperti di sumber, mis. "Juventus Next Gen" */
  name: string;
  league: string;
  standings: WStandingRow[];
  position: number | null;
  played: number;
  points: number;
  record: { w: number; d: number; l: number };
  /** 5 hasil terakhir, lama → baru */
  form: ('M' | 'S' | 'K')[];
  /** terbaru dulu */
  results: WMatch[];
  /** terdekat dulu */
  next: WMatch[];
  topScorers: { name: string; goals: number }[];
  coach: string;
  stadium: string;
}

export interface AcademyPlayer {
  id: string;
  name: string;
  team: AcademyKey;
  age: number | null;
  group: SquadGroup;
  jersey: string;
  photo: string;
}

export interface LoanMatch {
  id: string;
  iso: string;
  opponent: string;
  home: boolean;
  competition: string;
  score: { us: number; them: number } | null;
  result: 'M' | 'S' | 'K' | null;
  minutes: number;
  rating: number | null;
  goals: number;
  assists: number;
}

export interface LoanPlayer {
  id: string;
  name: string;
  photo: string;
  age: number | null;
  position: string;
  club: string;
  clubId: string;
  league: string;
  /** 5 laga terakhir di klub peminjam, terbaru dulu */
  matches: LoanMatch[];
  apps: number;
  minutes: number;
  /** menit dibanding 90 × jumlah laga yang dihitung (0–100) */
  minutesPct: number;
  goals: number;
  assists: number;
  rating: number | null;
}

export interface AkademiResponse {
  nextgen: AcademyTeam | null;
  squad: AcademyPlayer[];
  loans: LoanPlayer[];
  sources: { key: string; id: string; ok: boolean; note?: string }[];
  warnings: string[];
  updatedAt: string;
}

/* ---------- util ---------- */

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

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const resultLetter = (r: WMatch['result']): 'M' | 'S' | 'K' | null => (r === 'W' ? 'M' : r === 'D' ? 'S' : r === 'L' ? 'K' : null);

/* ---------- tim ---------- */

/** Top skor dari blok `byGoals` di mana pun posisinya dalam payload tim. */
export function parseTopScorers(data: any): { name: string; goals: number }[] {
  const out: { name: string; goals: number }[] = [];
  const walk = (n: any, depth: number, inGoals: boolean) => {
    if (!n || typeof n !== 'object' || depth > 9) return;
    if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1, inGoals));
    if (inGoals && n.name && (n.value != null || n.goals != null)) {
      const g = num(n.value ?? n.goals);
      if (g != null && g > 0) out.push({ name: str(n.name), goals: Math.round(g) });
      return;
    }
    for (const [k, v] of Object.entries(n)) if (v && typeof v === 'object') walk(v, depth + 1, inGoals || k === 'byGoals');
  };
  walk(data, 0, false);
  const seen = new Set<string>();
  return out.filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true))).sort((a, b) => b.goals - a.goals).slice(0, 5);
}

/** 1 Juli musim berjalan (musim Juli–Juni). */
export const seasonStartOf = (now: Date) => Date.UTC(now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1, 6, 1);

export interface TeamParseOptions {
  /** tabel yang dipilih bila ada beberapa (mis. /primavera/) */
  prefer?: RegExp;
  /** hanya laga dari kompetisi yang lolos filter ini */
  keep?: (tournament: string) => boolean;
}

export function parseAcademyTeam(data: any, key: AcademyKey, id: string, now: Date, opts: TeamParseOptions = {}): AcademyTeam {
  const { prefer, keep } = opts;
  const table = parseFotmobTable(data, id, prefer);
  const juve = table.rows.find((r) => r.isJuve) ?? null;
  // hanya musim berjalan: tanpa ini hasil musim lalu ikut tampil saat laga musim baru masih sedikit
  const start = seasonStartOf(now);
  const all = collectFixtures(data)
    .map((f) => parseFotmobMatch(f, id))
    .filter((m): m is WMatch => m !== null && new Date(m.iso).getTime() >= start && (!keep || keep(m.tournament ?? '')));
  const results = all.filter((m) => m.status === 'post').sort((a, b) => b.iso.localeCompare(a.iso));
  const live = all.filter((m) => m.status === 'live');
  const next = [...live, ...all.filter((m) => m.status === 'pre').sort((a, b) => a.iso.localeCompare(b.iso))];
  const form = results
    .slice(0, 5)
    .map((m) => resultLetter(m.result))
    .filter((x): x is 'M' | 'S' | 'K' => x !== null)
    .reverse();
  const sq = parseFotmob(data);
  return {
    key,
    id,
    name: str(data?.details?.name) || 'Juventus Next Gen',
    league: table.name,
    standings: table.rows,
    position: juve?.position ?? null,
    played: juve?.played ?? 0,
    points: juve?.points ?? 0,
    record: { w: juve?.won ?? 0, d: juve?.draw ?? 0, l: juve?.lost ?? 0 },
    form,
    results: results.slice(0, 8),
    next: next.slice(0, 6),
    topScorers: parseTopScorers(data),
    coach: sq.coach,
    stadium: str(data?.overview?.venue?.name ?? data?.overview?.venue?.widget?.name ?? data?.details?.sportsTeamJSONLD?.location?.name),
  };
}

export function parseAcademySquad(data: any, key: AcademyKey): AcademyPlayer[] {
  return parseFotmob(data).players.map((p) => ({ id: p.id, name: p.name, team: key, age: p.age, group: p.group, jersey: p.jersey, photo: p.photo }));
}

/* ---------- pinjaman ---------- */

/** Pemain pinjaman dari `playerData` FotMob: 5 laga terakhir di klub peminjam. */
export function parseLoanee(data: any, id: string): LoanPlayer | null {
  const name = str(data?.name);
  if (!name) return null;
  const club = str(data?.primaryTeam?.teamName);
  const clubId = str(data?.primaryTeam?.teamId);
  const born = new Date(str(data?.birthDate?.utcTime)).getTime();
  const age = Number.isFinite(born) ? Math.floor((Date.now() - born) / (365.25 * 86400000)) : null;

  const list: any[] = Array.isArray(data?.recentMatches) ? data.recentMatches : [];
  const matches: LoanMatch[] = list
    .filter((m) => !clubId || !m?.teamId || String(m.teamId) === clubId) // buang laga timnas
    .map((m): LoanMatch | null => {
      const t = new Date(str(m?.matchDate?.utcTime ?? m?.matchDate)).getTime();
      if (!Number.isFinite(t)) return null;
      const home = m?.isHomeTeam === true;
      const hs = num(m?.homeScore);
      const as = num(m?.awayScore);
      const score = hs != null && as != null ? (home ? { us: hs, them: as } : { us: as, them: hs }) : null;
      const rating = num(m?.ratingProps?.num ?? m?.rating);
      return {
        id: str(m?.id),
        iso: new Date(t).toISOString(),
        opponent: str(m?.opponentTeamName),
        home,
        competition: str(m?.leagueName),
        score,
        result: score ? (score.us > score.them ? 'M' : score.us < score.them ? 'K' : 'S') : null,
        minutes: m?.onBench ? 0 : num(m?.minutesPlayed) ?? 0,
        rating: rating != null && rating > 0 ? Math.round(rating * 10) / 10 : null,
        goals: num(m?.goals) ?? 0,
        assists: num(m?.assists) ?? 0,
      };
    })
    .filter((m): m is LoanMatch => m !== null)
    .sort((a, b) => b.iso.localeCompare(a.iso))
    .slice(0, 5);

  const played = matches.filter((m) => m.minutes > 0);
  const minutes = matches.reduce((n, m) => n + m.minutes, 0);
  const rated = matches.map((m) => m.rating).filter((r): r is number => r != null);
  return {
    id,
    name,
    photo: fotmobPhoto(id),
    age,
    position: str(data?.positionDescription?.primaryPosition?.label),
    club,
    clubId,
    league: str(data?.mainLeague?.leagueName),
    matches,
    apps: played.length,
    minutes,
    minutesPct: matches.length ? Math.min(100, Math.round((minutes / (matches.length * 90)) * 100)) : 0,
    goals: matches.reduce((n, m) => n + m.goals, 0),
    assists: matches.reduce((n, m) => n + m.assists, 0),
    rating: rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 100) / 100 : null,
  };
}

/* ---------- gabungan ---------- */

export async function fetchAkademi(now = new Date()): Promise<AkademiResponse> {
  const warnings: string[] = [];
  const sources: AkademiResponse['sources'] = [];
  const [ngData, firstData] = await Promise.all([fm(`teams?id=${FOTMOB_NEXTGEN_ID}&ccode3=IDN`, 900), fm(`teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 1800)]);

  const nextgen = ngData ? parseAcademyTeam(ngData, 'nextgen', FOTMOB_NEXTGEN_ID, now) : null;
  sources.push({ key: 'nextgen', id: FOTMOB_NEXTGEN_ID, ok: Boolean(nextgen), note: nextgen ? `${nextgen.league || 'tanpa tabel'} · ${nextgen.standings.length} tim · ${nextgen.results.length} hasil · ${nextgen.next.length} jadwal` : undefined });
  if (!nextgen) warnings.push('Data Juventus Next Gen tidak bisa dimuat dari FotMob.');

  const squad = ngData ? parseAcademySquad(ngData, 'nextgen') : [];

  // pemain pinjaman: transfer keluar berstatus pinjaman sejak 1 Juni musim berjalan
  let loans: LoanPlayer[] = [];
  if (!firstData) {
    warnings.push('Data tim utama FotMob tidak bisa dimuat, jadi daftar pemain pinjaman tidak tersedia.');
    sources.push({ key: 'loans', id: FOTMOB_TEAM_ID, ok: false });
  } else {
    const outs = (parseTransfers(firstData, FOTMOB_TEAM_ID, now)?.out ?? []).filter((t) => t.loan).slice(0, 10);
    const results = await Promise.all(outs.map((t) => fm(`playerData?id=${encodeURIComponent(t.id)}`, 1800)));
    loans = results.map((d, i) => (d ? parseLoanee(d, outs[i].id) : null)).filter((l): l is LoanPlayer => l !== null);
    sources.push({ key: 'loans', id: FOTMOB_TEAM_ID, ok: true, note: `${outs.length} transfer pinjaman keluar, ${loans.length} berhasil dimuat` });
  }

  return { nextgen, squad, loans, sources, warnings, updatedAt: now.toISOString() };
}
