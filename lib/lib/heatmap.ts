// Heatmap pemain dari FotMob: sentuhan bola di laga-laga terakhirnya, digabung jadi satu peta.
// Alurnya: playerData (daftar laga) → heatmap per laga → ambil titik milik pemain itu.
// FotMob tidak resmi dan melarang akses otomatis di robots.txt: kalau diblokir, hasilnya kosong dan popup menyembunyikan bagian ini.
import { findPlayer, juveSquadPool } from './fotmob';
import { collectByPlayer, playerPoints, type Point } from './heatmap-parse';
import { parseForm } from './player';

export interface HeatmapResponse {
  points: Point[];
  /** laga yang punya data heatmap untuk pemain ini */
  matches: number;
  /** laga yang dicoba (laga terakhir yang dimainkan, maksimal 10) */
  tried: number;
  updatedAt: string;
}

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; bianconeri-matchday-hub)',
};

async function getText(url: string, revalidate: number): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, next: { revalidate }, signal: AbortSignal.timeout(10000) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

const parse = (text: string | null): unknown => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text; // bukan JSON: mungkin langsung SVG/teks; pembaca tetap mencari <circle>
  }
};

export const heatmapUrl = (matchId: string) =>
  `https://www.fotmob.com/api/data/heatmap/match/${matchId}/heatmaps?heatmapUrl=${encodeURIComponent(`https://pub.fotmob.com/prod/db/api/heatmap/match/${matchId}`)}&theme=light`;

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

async function resolve(name: string) {
  const hit = findPlayer(name, await juveSquadPool());
  if (!hit) return null;
  const data = parse(await getText(`https://www.fotmob.com/api/data/playerData?id=${encodeURIComponent(hit.id)}`, 1800));
  const form = typeof data === 'object' && data ? parseForm(data).filter((f) => f.id && f.minutes > 0) : [];
  const info = typeof data === 'object' && data ? (data as any) : {};
  return { id: hit.id, form, playerName: String(info.name ?? ''), team: String(info.primaryTeam?.teamName ?? '') };
}

export async function fetchHeatmap(name: string): Promise<HeatmapResponse | null> {
  const who = await resolve(name);
  if (!who || !who.form.length) return null;

  const perMatch = await mapLimit(who.form, 4, async (f) => playerPoints(parse(await getText(heatmapUrl(f.id), 86400)), who.id));
  const used = perMatch.filter((p): p is Point[] => Boolean(p));
  if (!used.length) return null;
  return { points: used.flat(), matches: used.length, tried: who.form.length, updatedAt: new Date().toISOString() };
}

/** Untuk pelacakan: per laga, apakah FotMob punya heatmap dan apakah pemain ini ada di dalamnya (tanpa isi titik). */
export async function debugHeatmap(name: string) {
  const who = await resolve(name);
  if (!who) return { error: 'pemain tidak ditemukan di skuad FotMob' };
  const laga = await mapLimit(who.form, 4, async (f) => {
    const text = await getText(heatmapUrl(f.id), 600);
    const json = parse(text);
    const by = json && typeof json === 'object' ? collectByPlayer(json) : new Map<string, Point[]>();
    return {
      matchId: f.id,
      tanggal: f.iso.slice(0, 10),
      lawan: f.oppName,
      kompetisi: f.competition,
      menit: f.minutes,
      diambil: text != null,
      jumlahPemainDiHeatmap: by.size,
      adaPemainIni: by.has(who.id),
      titikPemainIni: by.get(who.id)?.length ?? 0,
    };
  });
  return { playerId: who.id, nama: name, laga };
}
