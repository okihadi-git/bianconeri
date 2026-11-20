// Jembatan ESPN ↔ FotMob untuk tab Analisa: mencocokkan laga ESPN dengan laga FotMob lewat waktu kick-off, lalu mengambil
// matchDetails-nya (cache Next 6 jam, dipakai bersama Analitik). Dipakai Pola dan Kiper (xG) serta Penonton (jumlah penonton).
// Endpoint FotMob tidak resmi: semua kegagalan = hasil kosong, tidak pernah error.
import { FOTMOB_TEAM_ID } from '../core/squad';
import { finishedFixtureIds, getJson } from '../analitik/kreator-server';

const WINDOW_MS = 4 * 3600 * 1000;

export interface GameRef {
  /** id event ESPN */
  id: string;
  iso: string;
}

/** matchDetails FotMob untuk tiap laga ESPN yang ketemu pasangannya (kunci: id event ESPN). */
export async function fotmobDetails(games: GameRef[]): Promise<{ details: Map<string, any>; tried: number }> {
  const details = new Map<string, any>();
  const team = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 600).catch(() => null);
  const fixtures = team ? finishedFixtureIds(team) : [];
  if (!fixtures.length) return { details, tried: 0 };

  const used = new Set<string>();
  const pairs: { game: GameRef; fid: string }[] = [];
  for (const g of games) {
    const t = new Date(g.iso).getTime();
    const hit = fixtures.filter((f) => !used.has(f.id) && Math.abs(f.t - t) <= WINDOW_MS).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
    if (hit) {
      used.add(hit.id);
      pairs.push({ game: g, fid: hit.id });
    }
  }
  for (let i = 0; i < pairs.length; i += 6) {
    const batch = pairs.slice(i, i + 6);
    const res = await Promise.all(batch.map((p) => getJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${p.fid}`, 6 * 3600).catch(() => null)));
    res.forEach((d, k) => d && details.set(batch[k].game.id, d));
  }
  return { details, tried: pairs.length };
}

const toInt = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as any).value ?? (v as any).text ?? (v as any).number : v;
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[,.\s](?=\d{3}\b)/g, '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/** Jumlah penonton dan nama stadion dari info laga FotMob (content.matchFacts.infoBox). Nama kunci dicari longgar. */
export function parseFmMatchInfo(d: any): { attendance: number | null; venue: string | null } {
  const facts = d?.content?.matchFacts;
  const box = facts?.infoBox ?? facts?.info ?? null;
  let attendance: number | null = null;
  let venue: string | null = null;
  const walk = (n: any, depth: number) => {
    if (!n || typeof n !== 'object' || depth > 4) return;
    for (const [k, v] of Object.entries<any>(n)) {
      if (attendance == null && /^attendance$/i.test(k)) attendance = toInt(v);
      else if (venue == null && /^(stadium|venue)$/i.test(k)) venue = String((v && typeof v === 'object' ? v.name ?? v.text : v) ?? '').trim() || null;
      else if (v && typeof v === 'object') walk(v, depth + 1);
    }
  };
  walk(box, 0);
  return { attendance, venue };
}

/** Jumlah penonton dari FotMob untuk laga-laga yang kosong di ESPN. */
export async function fotmobAttendance(games: GameRef[]): Promise<Map<string, { attendance: number | null; venue: string | null }>> {
  const { details } = await fotmobDetails(games);
  const out = new Map<string, { attendance: number | null; venue: string | null }>();
  for (const [id, d] of details) out.set(id, parseFmMatchInfo(d));
  return out;
}
