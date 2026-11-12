// Analitik → Kondisi laga Juventus. FotMob matchDetails, gabungan semua kompetisi resmi (laga persahabatan tidak dihitung).
import { isFriendly } from './official';
import { FOTMOB_TEAM_ID } from './squad';
import { finishedFixtureIds, getJson } from './kreator-server';
import { aggregate, parseMatchCondition, type CondMatch, type KondisiResponse } from './kondisilaga';

export async function fetchKondisiLaga(): Promise<KondisiResponse> {
  const empty = (warning: string): KondisiResponse => ({ buckets: [], matches: 0, warnings: [warning], updatedAt: new Date().toISOString() });

  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return empty('Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.');

  const matches: CondMatch[] = [];
  let friendlies = 0; // laga persahabatan tidak dihitung
  for (let i = 0; i < fixtures.length; i += 6) {
    const batch = fixtures.slice(i, i + 6);
    const res = await Promise.all(batch.map((f) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${f.id}`, 6 * 3600)));
    res.forEach((d) => {
      if (d && isFriendly(d)) friendlies += 1;
      const m = d && !isFriendly(d) ? parseMatchCondition(d, FOTMOB_TEAM_ID) : null;
      if (m) matches.push(m);
    });
  }

  if (!matches.length) return empty('FotMob tidak mengirim detail laga Juventus (endpoint tidak resmi, mungkin diblokir).');
  const warnings: string[] = [];
  if (matches.length < fixtures.length - friendlies) warnings.push(`Detail hanya tersedia untuk ${matches.length} dari ${fixtures.length - friendlies} laga resmi selesai.`);
  if (matches.some((m) => m.xgFor == null)) warnings.push('Sebagian laga tidak punya data xG, jadi tidak ikut dihitung di baris xG.');

  return { buckets: aggregate(matches), matches: matches.length, warnings, updatedAt: new Date().toISOString() };
}
