// Analitik → Peluang diciptakan Juventus. FotMob (umpan kunci, xA, tembakan per situasi) + database gaji (opsional).
// FotMob tidak resmi: semua kegagalan jadi data kosong + peringatan, tidak pernah melempar error.
import { FOTMOB_TEAM_ID, fotmobPhoto } from './squad';
import { fetchSalaries } from './salaries-server';
import { salaryFrom, yearlyOf } from './salaries';
import { aggregate, parseMatchDetails, type KreatorResponse, type MatchChance } from './kreator';

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; bianconeri-matchday-hub)',
};

async function getJson(url: string, revalidate: number): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, next: { revalidate }, signal: AbortSignal.timeout(10_000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Semua laga Juventus yang sudah selesai di data tim FotMob (tanpa asumsi letak cabangnya). */
function finishedFixtureIds(team: any): { id: string; t: number }[] {
  const out = new Map<string, number>();
  const walk = (n: any, depth = 0) => {
    if (!n || typeof n !== 'object' || depth > 8) return;
    if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1));
    const t = new Date(n?.status?.utcTime ?? '').getTime();
    if (n?.id != null && Number.isFinite(t) && (n.home || n.away) && n.status?.finished === true && !n.status?.cancelled) out.set(String(n.id), t);
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(team);
  return [...out.entries()].map(([id, t]) => ({ id, t })).sort((a, b) => a.t - b.t);
}

export async function fetchKreator(comp = 'all'): Promise<KreatorResponse> {
  const empty = (warning: string): KreatorResponse => ({
    top: [], rankedBy: 'xa', cards: { xa: null, chances: null, big: null, total: { chances: 0, matches: 0 } },
    ways: [], waysTotal: 0, competitions: [], comp, warnings: [warning], updatedAt: new Date().toISOString(),
  });

  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return empty('Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.');

  const matches: MatchChance[] = [];
  for (let i = 0; i < fixtures.length; i += 6) {
    const batch = fixtures.slice(i, i + 6);
    const res = await Promise.all(batch.map((f) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${f.id}`, 6 * 3600)));
    res.forEach((d) => {
      const m = d ? parseMatchDetails(d, FOTMOB_TEAM_ID) : null;
      if (m) matches.push(m);
    });
  }

  const warnings: string[] = [];
  if (!matches.length) return empty('FotMob tidak mengirim statistik pemain untuk laga Juventus (endpoint tidak resmi, mungkin diblokir).');
  if (matches.length < fixtures.length) warnings.push(`Statistik pemain hanya tersedia untuk ${matches.length} dari ${fixtures.length} laga selesai.`);

  const compMap = new Map<string, { id: string; name: string; matches: number }>();
  for (const m of matches) {
    const c = compMap.get(m.leagueId) ?? { id: m.leagueId, name: m.leagueName, matches: 0 };
    c.matches += 1;
    compMap.set(m.leagueId, c);
  }
  const competitions = [...compMap.values()].sort((a, b) => b.matches - a.matches);
  const picked = comp === 'all' ? matches : matches.filter((m) => m.leagueId === comp);

  // Database gaji dipakai bila ada; kalau tidak, kolom gaji kosong (tidak ada angka karangan).
  const salaries = await fetchSalaries().catch(() => null);
  const salaryOf = (p: { id: string; name: string }) => {
    const s = salaryFrom(salaries, { name: p.name, ids: { fotmob: p.id } });
    return s ? yearlyOf(s) : null;
  };

  const body = aggregate(picked, { photo: fotmobPhoto, salaryOf });
  if (!body.top.length) warnings.push('Tidak ada umpan kunci atau xA yang tercatat untuk pilihan ini.');
  else if (body.rankedBy === 'chances') warnings.push('FotMob tidak melaporkan xA, jadi peringkat memakai jumlah umpan kunci.');

  return { ...body, competitions, comp, warnings, updatedAt: new Date().toISOString() };
}
