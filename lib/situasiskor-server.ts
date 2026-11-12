// Analitik → Situasi skor Juventus. FotMob matchDetails (kejadian gol). Cache Next dipakai bersama section 01 dan 02.
import { isFriendly } from './official';
import { FOTMOB_TEAM_ID } from './squad';
import { finishedFixtureIds, getJson } from './kreator-server';
import { aggregate, parseMatchFlow, type MatchFlow, type SituasiSkorResponse } from './situasiskor';

export async function fetchSituasiSkor(comp = 'all'): Promise<SituasiSkorResponse> {
  const empty = (warning: string): SituasiSkorResponse => ({
    ...aggregate([]), competitions: [], comp, warnings: [warning], updatedAt: new Date().toISOString(),
  });

  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return empty('Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.');

  const flows: MatchFlow[] = [];
  let friendlies = 0; // laga persahabatan tidak dihitung
  for (let i = 0; i < fixtures.length; i += 6) {
    const batch = fixtures.slice(i, i + 6);
    const res = await Promise.all(batch.map((f) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${f.id}`, 6 * 3600)));
    res.forEach((d) => {
      if (d && isFriendly(d)) friendlies += 1;
      const m = d && !isFriendly(d) ? parseMatchFlow(d, FOTMOB_TEAM_ID) : null;
      if (m) flows.push(m);
    });
  }

  if (!flows.length) return empty('FotMob tidak mengirim kejadian gol untuk laga Juventus (endpoint tidak resmi, mungkin diblokir).');
  const warnings: string[] = [];
  if (flows.length < fixtures.length - friendlies) warnings.push(`Kejadian gol lengkap hanya tersedia untuk ${flows.length} dari ${fixtures.length - friendlies} laga selesai.`);

  const compMap = new Map<string, { id: string; name: string; matches: number }>();
  for (const m of flows) {
    const c = compMap.get(m.leagueId) ?? { id: m.leagueId, name: m.leagueName, matches: 0 };
    c.matches += 1;
    compMap.set(m.leagueId, c);
  }
  const competitions = [...compMap.values()].sort((a, b) => b.matches - a.matches);
  const picked = comp === 'all' ? flows : flows.filter((m) => m.leagueId === comp);

  return { ...aggregate(picked), competitions, comp, warnings, updatedAt: new Date().toISOString() };
}
