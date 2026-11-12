// Analitik → Penguasaan bola Juventus. FotMob matchDetails (statistik laga + peta tembakan). Cache Next dipakai bersama section 01–05.
// Laga persahabatan klub tidak dihitung (bukan pertandingan resmi).
import { isFriendly } from './official';
import { FOTMOB_TEAM_ID } from './squad';
import { finishedFixtureIds, getJson } from './kreator-server';
import { aggregate, parseMatchPossession, type PossMatch, type PossessionResponse } from './penguasaan';

export async function fetchPenguasaan(comp = 'all'): Promise<PossessionResponse> {
  const empty = (warning: string): PossessionResponse => ({
    ...aggregate([]), competitions: [], comp, warnings: [warning], updatedAt: new Date().toISOString(),
  });

  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return empty('Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.');

  const matches: PossMatch[] = [];
  let friendlies = 0; // laga persahabatan tidak dihitung
  for (let i = 0; i < fixtures.length; i += 6) {
    const batch = fixtures.slice(i, i + 6);
    const res = await Promise.all(batch.map((f) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${f.id}`, 6 * 3600)));
    res.forEach((d) => {
      if (d && isFriendly(d)) friendlies += 1;
      const m = d && !isFriendly(d) ? parseMatchPossession(d, FOTMOB_TEAM_ID) : null;
      if (m) matches.push(m);
    });
  }

  if (!matches.length) return empty('FotMob tidak mengirim statistik penguasaan bola untuk laga Juventus (endpoint tidak resmi, mungkin diblokir).');
  const warnings: string[] = [];
  if (matches.length < fixtures.length - friendlies) warnings.push(`Penguasaan bola hanya tersedia untuk ${matches.length} dari ${fixtures.length - friendlies} laga resmi selesai.`);

  const compMap = new Map<string, { id: string; name: string; matches: number }>();
  for (const m of matches) {
    const c = compMap.get(m.leagueId) ?? { id: m.leagueId, name: m.leagueName, matches: 0 };
    c.matches += 1;
    compMap.set(m.leagueId, c);
  }
  const competitions = [...compMap.values()].sort((a, b) => b.matches - a.matches);
  const picked = comp === 'all' ? matches : matches.filter((m) => m.leagueId === comp);

  const body = aggregate(picked);
  if (picked.length && picked.some((m) => m.xgFor == null)) warnings.push('Sebagian laga tidak punya data xG, jadi tidak ikut dihitung di xG dan grafik sebar.');
  return { ...body, competitions, comp, warnings, updatedAt: new Date().toISOString() };
}
