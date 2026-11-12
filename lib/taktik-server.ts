import { FOTMOB_TEAM_ID } from './squad';
import { finishedFixtureIds, getJson } from './kreator-server';
import { buildRingkasan, parseTaktik, type TaktikMatch } from './taktik';

export interface TaktikResponse {
  musim: string;
  matches: number;
  ringkasan: string[];
  warnings: string[];
  updatedAt: string;
}

export async function fetchTaktik(): Promise<TaktikResponse> {
  const base = { musim: '', matches: 0, ringkasan: [] as string[], updatedAt: new Date().toISOString() };
  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return { ...base, warnings: ['Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.'] };

  const matches: TaktikMatch[] = [];
  for (let i = 0; i < fixtures.length; i += 6) {
    const res = await Promise.all(fixtures.slice(i, i + 6).map((f) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${f.id}`, 6 * 3600)));
    res.forEach((d) => {
      const m = d ? parseTaktik(d, FOTMOB_TEAM_ID) : null;
      if (m) matches.push(m);
    });
  }
  if (!matches.length) return { ...base, warnings: ['FotMob tidak mengirim data taktik untuk laga Juventus (endpoint tidak resmi, mungkin diblokir).'] };

  const warnings: string[] = [];
  if (matches.length < fixtures.length) warnings.push(`Data tersedia untuk ${matches.length} dari ${fixtures.length} laga selesai.`);
  return { ...base, matches: matches.length, ringkasan: buildRingkasan(matches), warnings };
}
