// Analisa → Pola laga. ESPN: menit gol + skor (loadJuve) dan klasemen Serie A (loadSeason). xG: FotMob, opsional (boleh kosong).
import { FOTMOB_TEAM_ID } from '../core/squad';
import { loadJuve } from '../core/juve';
import { parseMatchPadat } from '../analitik/padat';
import { fotmobDetails, type GameRef } from './fotmob';
import { loadSeason } from '../kompetisi/peluang-server';
import { toGoals, type PolaGame, type PolaResponse } from './pola';

/** xG tiap laga ESPN dari FotMob (dicocokkan lewat waktu kick-off). Gagal = kosong, bukan error. */
export async function xgByMatch(games: PolaGame[] | GameRef[]): Promise<{ xg: Map<string, { f: number; a: number }>; tried: number }> {
  const { details, tried } = await fotmobDetails(games);
  const xg = new Map<string, { f: number; a: number }>();
  for (const [id, d] of details) {
    const m = parseMatchPadat(d, FOTMOB_TEAM_ID);
    if (m && m.xgFor != null && m.xgAgainst != null) xg.set(id, { f: m.xgFor, a: m.xgAgainst });
  }
  return { xg, tried };
}

export async function fetchPola(): Promise<PolaResponse> {
  const [juve, season] = await Promise.all([loadJuve().catch(() => null), loadSeason('ita.1').catch(() => null)]);
  const warnings: string[] = [];
  const past = juve ? [...juve.past].reverse() : []; // urut dari laga paling awal
  if (!past.length) return { games: [], positions: {}, warnings: ['Belum ada laga Juventus yang selesai di data ESPN.'], updatedAt: new Date().toISOString() };

  const games: PolaGame[] = past.map((m) => {
    const { goals, timeline } = toGoals(m.events, m.juveScore, m.opponentScore);
    return { id: m.id, league: m.league, competition: m.competition, iso: m.iso, home: m.isHome, oppId: m.opponentId, gf: m.juveScore, ga: m.opponentScore, goals, timeline, xgFor: null, xgAgainst: null };
  });

  const positions: Record<string, number> = {};
  if (season) for (const r of season.rows) positions[r.id] = r.position;
  else warnings.push('Klasemen Serie A belum bisa dimuat dari ESPN, jadi baris "level lawan" tidak tampil.');

  const noTimeline = games.filter((g) => !g.timeline).length;
  if (noTimeline) warnings.push(`Menit gol tidak cocok dengan skor akhir di ${noTimeline} dari ${games.length} laga (mis. data ESPN kosong); laga itu tidak ikut peta waktu gol dan situasi skor.`);

  const { xg, tried } = await xgByMatch(games).catch(() => ({ xg: new Map<string, { f: number; a: number }>(), tried: 0 }));
  for (const g of games) {
    const x = xg.get(g.id);
    if (x) {
      g.xgFor = x.f;
      g.xgAgainst = x.a;
    }
  }
  if (!xg.size) warnings.push('xG per laga tidak tersedia dari FotMob (endpoint tidak resmi, mungkin diblokir); kolom xG ditampilkan "–".');
  else if (xg.size < games.length) warnings.push(`xG hanya tersedia untuk ${xg.size} dari ${games.length} laga${tried < games.length ? ' (sisanya tidak ditemukan di FotMob)' : ''}; rata-rata xG dihitung dari laga itu saja.`);

  return { games, positions, warnings, updatedAt: new Date().toISOString() };
}
