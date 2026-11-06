// FotMob: foto pemain (CDN publik images.fotmob.com) dan rating resmi per laga.
// Endpoint FotMob tidak resmi dan bisa berubah/memblokir kapan saja, jadi SEMUA fungsi di sini
// tidak pernah melempar error: kalau gagal, hasilnya kosong dan pemanggil memakai cadangan (ESPN / inisial).
import { fetchFotmob, FOTMOB_TEAM_ID, fotmobPhoto } from './squad';
import { findPlayer } from './names';
import type { LiveMatch } from './types';

// Pencocokan nama dipindah ke ./names (aman dipakai di sisi klien); diekspor ulang supaya impor lama tetap jalan.
export { findPlayer, normName } from './names';

export interface FmPlayer {
  id: string;
  name: string;
  photo: string;
  /** rating resmi FotMob untuk laga ini; null bila tidak ada */
  rating: number | null;
}

export interface FmMatch {
  matchId: string;
  home: FmPlayer[];
  away: FmPlayer[];
}

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; bianconeri-matchday-hub)',
};

async function getJson(url: string, revalidate: number): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, next: { revalidate }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ---------- skuad Juventus (foto) ---------- */

/** Foto seluruh skuad Juventus dari FotMob. Kosong bila gagal. */
export async function juveSquadPool(): Promise<FmPlayer[]> {
  try {
    const { players } = await fetchFotmob();
    return players.filter((p) => p.photo).map((p) => ({ id: p.id, name: p.name, photo: p.photo, rating: null }));
  } catch {
    return [];
  }
}

/* ---------- laga: lineup + rating ---------- */

const numOf = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
};

function nameOf(n: any): string {
  const nm = n?.name;
  if (typeof nm === 'string') return nm;
  return String(nm?.fullName ?? ([nm?.firstName, nm?.lastName].filter(Boolean).join(' ') || n?.fullName || n?.shortName || '')).trim();
}

function ratingOf(n: any): number | null {
  return numOf(n?.performance?.rating) ?? numOf(n?.rating?.num) ?? numOf(typeof n?.rating === 'number' || typeof n?.rating === 'string' ? n.rating : null);
}

/** Kumpulkan semua node "pemain" (punya id, nama, dan nomor punggung/performa) di dalam satu cabang JSON. */
function collectPlayers(node: any, out: Map<string, FmPlayer> = new Map(), depth = 0): FmPlayer[] {
  if (!node || typeof node !== 'object' || depth > 8) return [...out.values()];
  if (Array.isArray(node)) {
    node.forEach((x) => collectPlayers(x, out, depth + 1));
    return [...out.values()];
  }
  const id = node.id ?? node.playerId;
  const name = nameOf(node);
  const looksLikePlayer = (typeof id === 'number' || /^\d+$/.test(String(id ?? ''))) && name && (node.shirtNumber !== undefined || node.performance || node.positionId !== undefined || node.usualPlayingPositionId !== undefined);
  if (looksLikePlayer) {
    const key = String(id);
    const prev = out.get(key);
    const rating = ratingOf(node);
    out.set(key, { id: key, name, photo: fotmobPhoto(key), rating: rating ?? prev?.rating ?? null });
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') collectPlayers(v, out, depth + 1);
  return [...out.values()];
}

/** Cari fixture Juventus di data tim FotMob yang jam mainnya dekat dengan `iso` (selisih < 4 jam). */
function findFixtureId(data: any, iso: string): string | null {
  const target = new Date(iso).getTime();
  let best: { id: string; diff: number } | null = null;
  const walk = (n: any, depth = 0) => {
    if (!n || typeof n !== 'object' || depth > 8) return;
    if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1));
    const t = new Date(n?.status?.utcTime ?? '').getTime();
    if (n?.id != null && Number.isFinite(t) && (n.home || n.away)) {
      const diff = Math.abs(t - target);
      if (diff < 4 * 3600 * 1000 && (!best || diff < best.diff)) best = { id: String(n.id), diff };
    }
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(data);
  return best ? (best as { id: string }).id : null;
}

/**
 * Lineup + rating FotMob untuk laga Juventus yang mulai pada `iso`.
 * Mengembalikan null bila laga tidak ditemukan / FotMob menolak permintaan.
 */
export async function fotmobMatch(iso: string): Promise<FmMatch | null> {
  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600);
  const matchId = team ? findFixtureId(team, iso) : null;
  if (!matchId) return null;

  const data = await getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${matchId}`, 600);
  const lineup = data?.content?.lineup;
  if (!lineup) return null;

  const sides = lineup.homeTeam || lineup.awayTeam ? [lineup.homeTeam, lineup.awayTeam] : Array.isArray(lineup) ? lineup : Array.isArray(lineup.lineup) ? lineup.lineup : [];
  const home = collectPlayers(sides[0]);
  const away = collectPlayers(sides[1]);
  if (!home.length && !away.length) return null;
  return { matchId, home, away };
}

/* ---------- tempel foto ke lineup (live) ---------- */

/** Isi `photo` pada tiap pemain di lineup. Foto FotMob diutamakan; kalau tak ada tetap kosong (UI memakai inisial). */
export async function attachPhotos(m: LiveMatch): Promise<LiveMatch> {
  try {
    const [fm, squad] = await Promise.all([fotmobMatch(m.iso), juveSquadPool()]);
    (['home', 'away'] as const).forEach((side) => {
      const lineup = m.lineups[side];
      if (!lineup) return;
      const isJuve = m[side].isJuve;
      const pools = [fm?.[side] ?? [], ...(isJuve ? [squad] : [])];
      for (const p of [...lineup.starters, ...lineup.subs]) {
        for (const pool of pools) {
          const hit = findPlayer(p.name, pool);
          if (hit) {
            p.photo = hit.photo;
            break;
          }
        }
      }
    });
  } catch {
    /* tanpa foto, UI memakai inisial */
  }
  return m;
}
