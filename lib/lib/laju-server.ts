// Mengambil hasil laga ESPN untuk grafik "Laju poin": musim ini semua klub, ditambah dua pembanding musim lalu
// (juara 2025/26 dan musim rekor Juventus). Pembanding yang gagal dimuat diberi null; grafik tetap tampil tanpa garis itu.
import { ESPN_BASE, fetchLeagueEvents, isCompleted, toNum } from './espn';
import { buildSeries, type Benchmark, type LajuTeam, type PointsMatch } from './laju';
import { loadSeason } from './peluang-server';

export interface LajuResponse {
  league: string;
  totalGames: number;
  teams: LajuTeam[];
  champion: Benchmark | null;
  record: Benchmark | null;
  warnings: string[];
  updatedAt: string;
}

/** Musim pembanding "rekor" untuk Juventus: 2013/14 (102 poin, rekor Serie A). Ganti `year` untuk musim lain, mis. 2011 (tak terkalahkan). */
export const RECORD = { year: 2013, club: 'Juventus' };

const toMatches = (events: any[]): PointsMatch[] =>
  events.filter(isCompleted).flatMap((e) => {
    const comps: any[] = e?.competitions?.[0]?.competitors ?? [];
    const h = comps.find((c) => c.homeAway === 'home');
    const a = comps.find((c) => c.homeAway === 'away');
    return h && a && e.date ? [{ iso: String(e.date), homeId: String(h.team?.id), awayId: String(a.team?.id), homeScore: toNum(h.score), awayScore: toNum(a.score) }] : [];
  });

interface FinalRow {
  id: string;
  name: string;
  points: number;
  rank: number;
  played: number;
}

async function finalTable(league: string, year: number): Promise<FinalRow[] | null> {
  try {
    const res = await fetch(`${ESPN_BASE}/v2/sports/soccer/${league}/standings?season=${year}`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const entries: any[] = data?.children?.flatMap((g: any) => g?.standings?.entries ?? []) ?? data?.standings?.entries ?? [];
    const rows = entries.map((e) => {
      const stat = (n: string) => Number((e.stats ?? []).find((s: any) => s.name === n)?.value ?? 0);
      return { id: String(e.team?.id ?? ''), name: String(e.team?.displayName ?? e.team?.name ?? ''), points: stat('points'), rank: stat('rank'), played: stat('gamesPlayed') };
    });
    if (rows.length < 16 || rows.some((r) => r.played < (rows.length - 1) * 2)) return null; // musim harus sudah selesai
    return rows.sort((a, b) => (a.rank || 99) - (b.rank || 99) || b.points - a.points);
  } catch {
    return null;
  }
}

/** Seri poin satu klub pada satu musim yang sudah selesai. */
async function benchmark(league: string, year: number, pick: (t: FinalRow[]) => FinalRow | undefined): Promise<Benchmark | null> {
  const table = await finalTable(league, year);
  const club = table && pick(table);
  if (!club) return null;
  const events = await fetchLeagueEvents(league, new Date(Date.UTC(year, 7, 1)), new Date(Date.UTC(year + 1, 5, 30))).catch(() => [] as any[]);
  const series = buildSeries(toMatches(events)).get(club.id) ?? [];
  if (series.length < (table!.length - 1) * 2 - 2) return null; // data laga tidak lengkap
  return { team: club.name, season: `${year}/${String(year + 1).slice(2)}`, total: club.points, series };
}

const cache = new Map<string, { at: number; sig: string; body: LajuResponse }>();

export async function fetchLaju(league = 'ita.1'): Promise<LajuResponse | null> {
  if (league !== 'ita.1') return null;
  const season = await loadSeason(league);
  if (!season) return null;
  const { rows, events, now } = season;
  const sig = `${league}:${rows.reduce((n, r) => n + r.played, 0)}`;
  const hit = cache.get(league);
  if (hit && hit.sig === sig && now.getTime() - hit.at < 15 * 60_000) return hit.body;

  const abbr = new Map<string, string>();
  for (const e of events) for (const c of e?.competitions?.[0]?.competitors ?? []) if (c?.team?.id) abbr.set(String(c.team.id), String(c.team.abbreviation ?? '').toUpperCase());
  const series = buildSeries(toMatches(events));
  const teams: LajuTeam[] = rows
    .map((r) => ({ id: r.id, name: r.name, abbr: abbr.get(r.id) || r.name.slice(0, 3).toUpperCase(), logo: r.logo, position: r.position, points: r.points, played: r.played, series: series.get(r.id) ?? [] }))
    .sort((a, b) => (a.position || 99) - (b.position || 99) || b.points - a.points);

  const lastDone = now.getUTCMonth() >= 6 ? now.getUTCFullYear() - 1 : now.getUTCFullYear() - 2;
  const [champion, record] = await Promise.all([
    benchmark(league, lastDone, (t) => t[0]),
    benchmark(league, RECORD.year, (t) => t.find((r) => r.name.includes(RECORD.club))),
  ]);

  const warnings: string[] = [];
  const short = teams.filter((t) => t.series.length !== t.played).length;
  if (short) warnings.push(`Hasil laga ESPN belum cocok dengan klasemen untuk ${short} klub, jadi garis mereka bisa kurang lengkap.`);
  if (!champion) warnings.push('Data musim juara sebelumnya belum bisa dimuat dari ESPN, jadi garis dan kartu pembandingnya disembunyikan.');
  if (!record) warnings.push(`Data musim ${RECORD.club} ${RECORD.year}/${String(RECORD.year + 1).slice(2)} belum bisa dimuat dari ESPN, jadi garis dan kartu pembandingnya disembunyikan.`);

  const body: LajuResponse = { league, totalGames: (rows.length - 1) * 2, teams, champion, record, warnings, updatedAt: now.toISOString() };
  cache.set(league, { at: now.getTime(), sig, body });
  return body;
}
