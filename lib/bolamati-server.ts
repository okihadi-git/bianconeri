// Analitik → Bola mati Juventus. FotMob matchDetails (peta tembakan kedua tim + kejadian). Cache Next dipakai bersama section 01–04.
import { isFriendly } from './official';
import { FOTMOB_TEAM_ID } from './squad';
import { finishedFixtureIds, getJson } from './kreator-server';
import { aggregate, parseMatchSetPieces, type MatchSetPieces, type SetPiecesResponse } from './bolamati';

export async function fetchBolaMati(comp = 'all'): Promise<SetPiecesResponse> {
  const empty = (warning: string): SetPiecesResponse => ({
    ...aggregate([]), competitions: [], comp, warnings: [warning], updatedAt: new Date().toISOString(),
  });

  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return empty('Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.');

  const matches: MatchSetPieces[] = [];
  let friendlies = 0; // laga persahabatan tidak dihitung
  for (let i = 0; i < fixtures.length; i += 6) {
    const batch = fixtures.slice(i, i + 6);
    const res = await Promise.all(batch.map((f) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${f.id}`, 6 * 3600)));
    res.forEach((d) => {
      if (d && isFriendly(d)) friendlies += 1;
      const m = d && !isFriendly(d) ? parseMatchSetPieces(d, FOTMOB_TEAM_ID) : null;
      if (m) matches.push(m);
    });
  }

  if (!matches.length) return empty('FotMob tidak mengirim peta tembakan untuk laga Juventus (endpoint tidak resmi, mungkin diblokir).');
  const warnings: string[] = [];
  if (matches.length < fixtures.length - friendlies) warnings.push(`Peta tembakan hanya tersedia untuk ${matches.length} dari ${fixtures.length - friendlies} laga selesai.`);

  const compMap = new Map<string, { id: string; name: string; matches: number }>();
  for (const m of matches) {
    const c = compMap.get(m.leagueId) ?? { id: m.leagueId, name: m.leagueName, matches: 0 };
    c.matches += 1;
    compMap.set(m.leagueId, c);
  }
  const competitions = [...compMap.values()].sort((a, b) => b.matches - a.matches);
  const picked = comp === 'all' ? matches : matches.filter((m) => m.leagueId === comp);

  const body = aggregate(picked);
  if (!body.hasXg && picked.length) warnings.push('FotMob tidak melaporkan xG, jadi kartu xG bola mati kosong.');
  return { ...body, competitions, comp, warnings, updatedAt: new Date().toISOString() };
}
