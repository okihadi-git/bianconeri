// Analitik → Profil skuad Juventus. Menit: FotMob matchDetails (lineup, memakai aggregateMatch milik Akademi).
// Usia, negara, status akademi: FotMob playerData. Cache Next dipakai bersama section 01–10. Laga persahabatan tidak dihitung.
import { aggregateMatch, toRows } from './akademi-stats';
import { isFriendly } from './official';
import { FOTMOB_TEAM_ID } from './squad';
import { parsePlayerData } from './player';
import { finishedFixtureIds, getJson } from './kreator-server';
import { aggregate, birthOf, isAcademyGrad, type PlayerMinutes, type SkuadResponse } from './skuad';

export async function fetchSkuad(): Promise<SkuadResponse> {
  const empty = (warning: string): SkuadResponse => ({ ...aggregate([]), warnings: [warning], updatedAt: new Date().toISOString() });

  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return empty('Jadwal laga selesai Juventus belum bisa dimuat dari FotMob.');

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
      const side = String(d?.general?.homeTeam?.id) === FOTMOB_TEAM_ID ? 'home' : String(d?.general?.awayTeam?.id) === FOTMOB_TEAM_ID ? 'away' : null;
      if (side && aggregateMatch(d, side, acc).lineup) withLineup += 1;
    });
  }
  const minutes = toRows(acc);
  if (!minutes.length) return empty('FotMob tidak mengirim susunan pemain untuk laga Juventus (endpoint tidak resmi, mungkin diblokir).');

  const rows: PlayerMinutes[] = [];
  let failed = 0;
  for (let i = 0; i < minutes.length; i += 6) {
    const batch = minutes.slice(i, i + 6);
    const res = await Promise.all(batch.map((p) => getJson(`https://www.fotmob.com/api/data/playerData?id=${encodeURIComponent(p.id)}`, 12 * 3600)));
    res.forEach((raw, k) => {
      const p = batch[k];
      if (!raw) failed += 1;
      const detail = raw ? parsePlayerData(raw, p.id) : null;
      rows.push({ id: p.id, name: p.name, minutes: p.minutes, birthIso: birthOf(detail?.birth?.iso), country: detail?.country ?? null, academy: raw ? isAcademyGrad(raw) : null });
    });
  }

  const body = aggregate(rows);
  const warnings: string[] = [];
  const official = fixtures.length - friendlies;
  if (withLineup < official) warnings.push(`Susunan pemain hanya tersedia untuk ${withLineup} dari ${official} laga resmi selesai, jadi total menit lebih rendah dari kenyataan.`);
  if (failed) warnings.push(`Profil ${failed} dari ${minutes.length} pemain tidak bisa dimuat dari FotMob; mereka tidak ikut hitungan usia, negara, dan akademi.`);
  return { ...body, warnings, updatedAt: new Date().toISOString() };
}
