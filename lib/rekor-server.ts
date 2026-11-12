// Analitik → Rekor beruntun Juventus. FotMob matchDetails (skor + kompetisi). Cache Next dipakai bersama section 01–06.
// Laga persahabatan klub tidak dihitung (bukan pertandingan resmi).
import { isFriendly } from './official';
import { FOTMOB_TEAM_ID } from './squad';
import { finishedFixtureIds, getJson } from './kreator-server';
import { aggregate, parseMatchResult, type RekorMatch, type RekorResponse } from './rekor';

export async function fetchRekor(): Promise<RekorResponse> {
  const empty = (warning: string): RekorResponse => ({ ...aggregate([]), warnings: [warning], updatedAt: new Date().toISOString() });

  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return empty('Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.');

  const matches: RekorMatch[] = [];
  let friendlies = 0; // laga persahabatan tidak dihitung
  for (let i = 0; i < fixtures.length; i += 6) {
    const batch = fixtures.slice(i, i + 6);
    const res = await Promise.all(batch.map((f) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${f.id}`, 6 * 3600)));
    res.forEach((d) => {
      if (d && isFriendly(d)) friendlies += 1;
      const m = d && !isFriendly(d) ? parseMatchResult(d, FOTMOB_TEAM_ID) : null;
      if (m) matches.push(m);
    });
  }

  if (!matches.length) return empty('FotMob tidak mengirim hasil laga Juventus (endpoint tidak resmi, mungkin diblokir).');
  const warnings: string[] = [];
  const official = fixtures.length - friendlies;
  // Bila ada laga yang gagal dimuat, rentetan bisa terlihat putus padahal tidak: peringatan wajib tampil.
  if (matches.length < official) warnings.push(`Hasil hanya tersedia untuk ${matches.length} dari ${official} laga resmi selesai, jadi rentetan bisa terlihat lebih pendek dari kenyataan.`);
  const body = aggregate(matches);
  if (!body.target) warnings.push('Laga Serie A belum ditemukan di data FotMob, jadi target kemenangan tidak ditampilkan.');
  return { ...body, warnings, updatedAt: new Date().toISOString() };
}
