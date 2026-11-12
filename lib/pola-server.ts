// Analisa → Pola laga. ESPN: menit gol + skor (loadJuve) dan klasemen Serie A (loadSeason). xG: FotMob, opsional (boleh kosong).
import { FOTMOB_TEAM_ID } from './squad';
import { loadJuve } from './juve';
import { finishedFixtureIds, getJson } from './kreator-server';
import { parseMatchPadat } from './padat';
import { loadSeason } from './peluang-server';
import { toGoals, type PolaGame, type PolaResponse } from './pola';

const MATCH_WINDOW_MS = 4 * 3600 * 1000;

/** xG tiap laga ESPN dari FotMob (dicocokkan lewat waktu kick-off). Gagal = kosong, bukan error. */
export async function xgByMatch(games: Pick<PolaGame, 'id' | 'iso'>[]): Promise<{ xg: Map<string, { f: number; a: number }>; tried: number }> {
  const out = new Map<string, { f: number; a: number }>();
  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600).catch(() => null);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return { xg: out, tried: 0 };

  const used = new Set<string>();
  const pairs: { game: Pick<PolaGame, 'id' | 'iso'>; fid: string }[] = [];
  for (const g of games) {
    const t = new Date(g.iso).getTime();
    const hit = fixtures.filter((f) => !used.has(f.id) && Math.abs(f.t - t) <= MATCH_WINDOW_MS).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
    if (hit) {
      used.add(hit.id);
      pairs.push({ game: g, fid: hit.id });
    }
  }
  for (let i = 0; i < pairs.length; i += 6) {
    const batch = pairs.slice(i, i + 6);
    const res = await Promise.all(batch.map((p) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${p.fid}`, 6 * 3600).catch(() => null)));
    res.forEach((d, k) => {
      const m = d ? parseMatchPadat(d, FOTMOB_TEAM_ID) : null;
      if (m && m.xgFor != null && m.xgAgainst != null) out.set(batch[k].game.id, { f: m.xgFor, a: m.xgAgainst });
    });
  }
  return { xg: out, tried: pairs.length };
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
