// Analitik → Disiplin Juventus. FotMob matchDetails (statistik tim + statistik pemain). Menit & kartu per pemain: aggregateMatch (Akademi).
// Cache Next dipakai bersama section 01–11. Laga persahabatan klub tidak dihitung.
import { aggregateMatch, toRows } from './akademi-stats';
import { isFriendly } from './official';
import { FOTMOB_TEAM_ID } from './squad';
import { finishedFixtureIds, getJson } from './kreator-server';
import { aggregate, parseMatchDisiplin, type DisiplinMatch, type DisiplinResponse } from './disiplin';

export async function fetchDisiplin(): Promise<DisiplinResponse> {
  const empty = (warning: string): DisiplinResponse => ({ ...aggregate([], []), warnings: [warning], updatedAt: new Date().toISOString() });

  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return empty('Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.');

  const matches: DisiplinMatch[] = [];
  const acc = new Map<string, any>();
  let friendlies = 0;
  let withLineup = 0;
  for (let i = 0; i < fixtures.length; i += 6) {
    const batch = fixtures.slice(i, i + 6);
    const res = await Promise.all(batch.map((f) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${f.id}`, 6 * 3600)));
    res.forEach((d) => {
      if (!d) return;
      if (isFriendly(d)) {
        friendlies += 1;
        return;
      }
      const m = parseMatchDisiplin(d, FOTMOB_TEAM_ID);
      if (!m) return;
      matches.push(m);
      const side = String(d?.general?.homeTeam?.id) === FOTMOB_TEAM_ID ? 'home' : 'away';
      if (aggregateMatch(d, side, acc).lineup) withLineup += 1;
    });
  }
  if (!matches.length) return empty('FotMob tidak mengirim statistik laga Juventus (endpoint tidak resmi, mungkin diblokir).');

  const base = toRows(acc).map((p) => ({ id: p.id, name: p.name, minutes: p.minutes, yellow: p.yellow, red: p.red }));
  const body = aggregate(matches, base);

  const warnings: string[] = [];
  const official = fixtures.length - friendlies;
  if (matches.length < official) warnings.push(`Statistik hanya tersedia untuk ${matches.length} dari ${official} laga resmi selesai.`);
  if (body.fouls.matches < matches.length) warnings.push(`Pelanggaran tim hanya tercatat di ${body.fouls.matches} dari ${matches.length} laga; rata-rata dihitung dari laga itu saja.`);
  if (body.offsides.matches < matches.length) warnings.push(`Offside hanya tercatat di ${body.offsides.matches} dari ${matches.length} laga.`);
  if (withLineup < matches.length) warnings.push(`Susunan pemain hanya tersedia untuk ${withLineup} dari ${matches.length} laga, jadi menit pemain (dan nilai per 90 menit) bisa meleset.`);
  if (!body.committed.length && !body.fouled.length) warnings.push('FotMob tidak menyediakan statistik pelanggaran per pemain, atau belum ada pemain dengan menit cukup.');
  return { ...body, warnings, updatedAt: new Date().toISOString() };
}
