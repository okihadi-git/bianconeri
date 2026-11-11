// Analitik → Penyelesaian Juventus. FotMob shotmap (koordinat + xG per tembakan, data Opta).
// FotMob tidak resmi: semua kegagalan jadi data kosong + peringatan, tidak pernah melempar error.
// URL matchDetails sama dengan "Peluang diciptakan", jadi hasil cache Next dipakai bersama (tidak unduh dua kali).
import { FOTMOB_TEAM_ID, fotmobPhoto } from './squad';
import { finishedFixtureIds, getJson } from './kreator-server';
import { aggregate, parseMatchShots, type MatchShots, type PenyelesaianResponse } from './penyelesaian';

export async function fetchPenyelesaian(comp = 'all'): Promise<PenyelesaianResponse> {
  const empty = (warning: string): PenyelesaianResponse => ({
    players: [], minShots: 2, matches: 0, hasXg: false, competitions: [], comp, warnings: [warning], updatedAt: new Date().toISOString(),
  });

  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return empty('Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.');

  const matches: MatchShots[] = [];
  for (let i = 0; i < fixtures.length; i += 6) {
    const batch = fixtures.slice(i, i + 6);
    const res = await Promise.all(batch.map((f) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${f.id}`, 6 * 3600)));
    res.forEach((d) => {
      const m = d ? parseMatchShots(d, FOTMOB_TEAM_ID) : null;
      if (m) matches.push(m);
    });
  }

  if (!matches.length) return empty('FotMob tidak mengirim peta tembakan untuk laga Juventus (endpoint tidak resmi, mungkin diblokir).');
  const warnings: string[] = [];
  if (matches.length < fixtures.length) warnings.push(`Peta tembakan hanya tersedia untuk ${matches.length} dari ${fixtures.length} laga selesai.`);

  const compMap = new Map<string, { id: string; name: string; matches: number }>();
  for (const m of matches) {
    const c = compMap.get(m.leagueId) ?? { id: m.leagueId, name: m.leagueName, matches: 0 };
    c.matches += 1;
    compMap.set(m.leagueId, c);
  }
  const competitions = [...compMap.values()].sort((a, b) => b.matches - a.matches);
  const picked = comp === 'all' ? matches : matches.filter((m) => m.leagueId === comp);

  const body = aggregate(picked, { photo: fotmobPhoto });
  if (!body.players.length) warnings.push(`Belum ada pemain dengan minimal ${body.minShots} tembakan untuk pilihan ini.`);
  else if (!body.hasXg) warnings.push('FotMob tidak melaporkan xG untuk tembakan ini, jadi selisih gol–xG tidak bermakna.');

  return { ...body, matches: picked.length, competitions, comp, warnings, updatedAt: new Date().toISOString() };
}
