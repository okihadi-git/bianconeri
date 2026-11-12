// Analitik → Pemain pengganti Juventus. FotMob matchDetails (lineup + kejadian). Cache Next dipakai bersama section 01–03.
import { FOTMOB_TEAM_ID } from './squad';
import { finishedFixtureIds, getJson } from './kreator-server';
import { aggregate, parseMatchSubs, type PenggantiResponse, type SubMatch } from './pengganti';

export async function fetchPengganti(comp = 'all'): Promise<PenggantiResponse> {
  const empty = (warning: string): PenggantiResponse => ({
    ...aggregate([]), competitions: [], comp, warnings: [warning], updatedAt: new Date().toISOString(),
  });

  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return empty('Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.');

  const matches: SubMatch[] = [];
  for (let i = 0; i < fixtures.length; i += 6) {
    const batch = fixtures.slice(i, i + 6);
    const res = await Promise.all(batch.map((f) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${f.id}`, 6 * 3600)));
    res.forEach((d) => {
      const m = d ? parseMatchSubs(d, FOTMOB_TEAM_ID) : null;
      if (m) matches.push(m);
    });
  }

  if (!matches.length) return empty('FotMob tidak mengirim susunan pemain untuk laga Juventus (endpoint tidak resmi, mungkin diblokir).');
  const warnings: string[] = [];
  if (matches.length < fixtures.length) warnings.push(`Susunan pemain hanya tersedia untuk ${matches.length} dari ${fixtures.length} laga selesai.`);

  const compMap = new Map<string, { id: string; name: string; matches: number }>();
  for (const m of matches) {
    const c = compMap.get(m.leagueId) ?? { id: m.leagueId, name: m.leagueName, matches: 0 };
    c.matches += 1;
    compMap.set(m.leagueId, c);
  }
  const competitions = [...compMap.values()].sort((a, b) => b.matches - a.matches);
  const picked = comp === 'all' ? matches : matches.filter((m) => m.leagueId === comp);

  const body = aggregate(picked);
  if (!body.totals.subs) warnings.push('Tidak ada data pergantian untuk pilihan ini.');
  return { ...body, competitions, comp, warnings, updatedAt: new Date().toISOString() };
}
