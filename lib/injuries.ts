// Pemain cedera di skuad Juventus, dari data detail pemain FotMob (playerData → injuryInformation).
// Sama dengan sumber "Kebugaran & cedera" di popup pemain, jadi dua tempat itu selalu sepakat.
// FotMob tidak resmi dan bisa memblokir: pemain yang gagal dimuat dihitung di `failed`, tidak pernah dianggap "sehat".
import { juveSquadPool } from './fotmob';
import { parsePlayerData } from './player';

export type InjuryStatus = 'lama' | 'diragukan' | 'segera' | 'absen';

export interface InjuredPlayer {
  id: string;
  name: string;
  photo: string;
  /** posisi dalam Bahasa Indonesia, mis. "Bek tengah" */
  position: string;
  /** jenis cedera (Indonesia bila dikenali, kalau tidak teks asli FotMob) */
  injury: string;
  injuryEn: string;
  /** perkiraan kembali, mis. "awal Desember"; null = FotMob tidak menyebut */
  returns: string | null;
  returnIso: string | null;
  status: InjuryStatus;
}

export interface InjuriesResponse {
  players: InjuredPlayer[];
  /** jumlah pemain skuad yang berhasil dicek di FotMob */
  checked: number;
  /** jumlah yang gagal dimuat (status cedera tidak diketahui) */
  failed: number;
  updatedAt: string;
}

/* ---------- terjemahan sederhana ---------- */

const POSITIONS: [RegExp, string][] = [
  [/goalkeeper|keeper/i, 'Kiper'],
  [/centre.?back|center.?back/i, 'Bek tengah'],
  [/right.?back/i, 'Bek kanan'],
  [/left.?back/i, 'Bek kiri'],
  [/right.?wing.?back/i, 'Wing-back kanan'],
  [/left.?wing.?back/i, 'Wing-back kiri'],
  [/defensive mid/i, 'Gelandang bertahan'],
  [/attacking mid/i, 'Gelandang serang'],
  [/central mid|centre mid|center mid/i, 'Gelandang tengah'],
  [/right.?mid/i, 'Gelandang kanan'],
  [/left.?mid/i, 'Gelandang kiri'],
  [/right.?wing/i, 'Sayap kanan'],
  [/left.?wing/i, 'Sayap kiri'],
  [/striker|centre.?forward|center.?forward/i, 'Penyerang tengah'],
  [/forward/i, 'Penyerang'],
  [/defender/i, 'Bek'],
  [/midfield/i, 'Gelandang'],
];
export const positionId = (en: string | null) => (en && POSITIONS.find(([re]) => re.test(en))?.[1]) || en || '';

const BODY: [RegExp, string][] = [
  [/quadriceps/i, 'paha depan (quadriceps)'],
  [/hamstring/i, 'otot paha belakang (hamstring)'],
  [/adductor|groin/i, 'pangkal paha'],
  [/thigh/i, 'paha'],
  [/calf/i, 'betis'],
  [/knee/i, 'lutut'],
  [/ankle/i, 'pergelangan kaki'],
  [/foot|toe/i, 'kaki'],
  [/hip/i, 'pinggul'],
  [/back/i, 'punggung'],
  [/shoulder/i, 'bahu'],
  [/achilles/i, 'tendon achilles'],
  [/ligament|cruciate|acl/i, 'ligamen'],
  [/muscle|muscular/i, 'otot'],
  [/head|concussion/i, 'kepala (gegar otak)'],
  [/rib|chest/i, 'tulang rusuk/dada'],
];

export function injuryId(en: string): string {
  const t = en.trim();
  if (!t) return 'Cedera (jenis belum dikonfirmasi)';
  if (/^(illness|sick|flu|virus)/i.test(t)) return 'Sakit';
  if (/^(knock|bruise)/i.test(t)) return 'Benturan';
  const part = BODY.find(([re]) => re.test(t))?.[1];
  if (!part) return t; // tidak dikenali: pakai teks asli, jangan menebak
  const kind = /fracture|broken/i.test(t) ? 'Patah tulang' : /surgery|operation/i.test(t) ? 'Operasi' : /strain|tear|torn|rupture/i.test(t) ? 'Cedera robek/tegang' : 'Cedera';
  return `${kind} ${part}`;
}

const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "Early December" → { label: "awal Desember", date: ~7 Des }. Teks tak dikenali: label = teks asli, date = null. */
export function parseReturn(text: string | null, now = new Date()): { label: string | null; date: Date | null } {
  const raw = (text ?? '').trim();
  if (!raw) return { label: null, date: null };

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return { label: `${d.getUTCDate()} ${MONTHS_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`, date: d };
  }

  const m = new RegExp(`(early|mid|late)?[\\s-]*(${MONTHS_EN.join('|')})(?:\\s+(\\d{4}))?`, 'i').exec(raw);
  if (m) {
    const month = MONTHS_EN.indexOf(m[2].toLowerCase());
    const part = (m[1] ?? '').toLowerCase();
    const day = part === 'early' ? 7 : part === 'late' ? 25 : 15;
    let year = m[3] ? +m[3] : now.getUTCFullYear();
    let date = new Date(Date.UTC(year, month, day));
    if (!m[3] && date.getTime() < now.getTime() - 30 * 86400000) date = new Date(Date.UTC(++year, month, day));
    const prefix = part === 'early' ? 'awal ' : part === 'late' ? 'akhir ' : part === 'mid' ? 'pertengahan ' : '';
    return { label: `${prefix}${MONTHS_ID[month]}${m[3] ? ` ${m[3]}` : ''}`, date };
  }
  return { label: raw, date: null };
}

export function classify(returnsText: string | null, injuryEn: string, date: Date | null, now = new Date()): InjuryStatus {
  if (/doubt|questionable|day.to.day|game.?time|fitness test/i.test(`${returnsText ?? ''} ${injuryEn}`)) return 'diragukan';
  if (date) {
    const days = (date.getTime() - now.getTime()) / 86400000;
    if (days <= 14) return 'segera';
    if (days > 28) return 'lama';
    return 'absen';
  }
  return /acl|cruciate|rupture|fracture|surgery|achilles/i.test(injuryEn) ? 'lama' : 'absen';
}

/* ---------- ambil data ---------- */

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; bianconeri-matchday-hub)',
};

async function playerData(id: string): Promise<any | null> {
  try {
    const res = await fetch(`https://www.fotmob.com/api/data/playerData?id=${encodeURIComponent(id)}`, {
      headers: HEADERS,
      next: { revalidate: 1800 }, // cache yang sama dengan popup pemain
      signal: AbortSignal.timeout(10000),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Jalankan `fn` untuk semua item, maksimal `limit` sekaligus (supaya FotMob tidak dibanjiri 30 permintaan). */
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

const ORDER: Record<InjuryStatus, number> = { lama: 0, absen: 1, diragukan: 2, segera: 3 };

export async function fetchInjuries(now = new Date()): Promise<InjuriesResponse | null> {
  const pool = await juveSquadPool();
  if (!pool.length) return null;

  const results = await mapLimit(pool, 6, async (p) => ({ p, data: await playerData(p.id) }));
  const players: InjuredPlayer[] = [];
  let checked = 0;
  let failed = 0;
  for (const { p, data } of results) {
    const detail = data ? parsePlayerData(data, p.id) : null;
    if (!detail) {
      failed++;
      continue;
    }
    checked++;
    if (!detail.injury) continue;
    const ret = parseReturn(detail.injury.returns, now);
    players.push({
      id: p.id,
      name: p.name,
      photo: p.photo,
      position: positionId(detail.position),
      injury: injuryId(detail.injury.name),
      injuryEn: detail.injury.name,
      returns: ret.label,
      returnIso: ret.date ? ret.date.toISOString() : null,
      status: classify(detail.injury.returns, detail.injury.name, ret.date, now),
    });
  }
  if (!checked) return null; // FotMob menolak semua permintaan: jangan pura-pura "tidak ada cedera"

  players.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));
  return { players, checked, failed, updatedAt: now.toISOString() };
}
