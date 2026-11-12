// Analitik → Jadwal padat Juventus. FotMob matchDetails (skor, kompetisi, xG). Cache Next dipakai bersama section 01–08.
// Laga persahabatan klub tidak dihitung (bukan pertandingan resmi), termasuk saat menghitung jeda.
import { isFriendly } from './official';
import { FOTMOB_TEAM_ID } from './squad';
import { finishedFixtureIds, getJson } from './kreator-server';
import { aggregate, parseMatchPadat, type PadatMatch, type PadatResponse } from './padat';

export async function fetchPadat(): Promise<PadatResponse> {
  const empty = (warning: string): PadatResponse => ({ ...aggregate([]), warnings: [warning], updatedAt: new Date().toISOString() });

  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return empty('Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.');

  const matches: PadatMatch[] = [];
  let friendlies = 0; // laga persahabatan tidak dihitung
  for (let i = 0; i < fixtures.length; i += 6) {
    const batch = fixtures.slice(i, i + 6);
    const res = await Promise.all(batch.map((f) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${f.id}`, 6 * 3600)));
    res.forEach((d) => {
      if (d && isFriendly(d)) friendlies += 1;
      const m = d && !isFriendly(d) ? parseMatchPadat(d, FOTMOB_TEAM_ID) : null;
      if (m) matches.push(m);
    });
  }

  if (!matches.length) return empty('FotMob tidak mengirim hasil laga Juventus (endpoint tidak resmi, mungkin diblokir).');
  const warnings: string[] = [];
  const official = fixtures.length - friendlies;
  // Laga yang gagal dimuat membuat jeda laga sesudahnya salah hitung, jadi peringatan wajib tampil.
  if (matches.length < official) warnings.push(`Hasil hanya tersedia untuk ${matches.length} dari ${official} laga resmi selesai, jadi sebagian jeda bisa terhitung lebih panjang dari kenyataan.`);
  const body = aggregate(matches);
  if (body.withXg < body.total) warnings.push(`xG hanya tersedia untuk ${body.withXg} dari ${body.total} laga; laga tanpa xG tidak ikut di selisih xG dan grafik sebar.`);
  return { ...body, warnings, updatedAt: new Date().toISOString() };
}
