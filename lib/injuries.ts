// Daftar pemain cedera Juventus dari FotMob (injuryInformation tiap pemain skuad).
// FotMob tidak resmi; bila satu pemain gagal dimuat, ia dilewati dan dihitung di `failed`. Tidak ada data karangan.
import { fetchFotmob } from './squad';
import { parsePlayerData } from './player';

export type InjuryKind = 'lama' | 'segera' | 'diragukan' | 'absen';

export interface InjuredPlayer {
  id: string;
  name: string;
  jersey: string;
  photo: string;
  /** posisi (Inggris, seperti FotMob) */
  position: string;
  /** jenis cedera dalam bahasa Indonesia; teks asli di injuryRaw */
  injury: string;
  injuryRaw: string;
  /** perkiraan kembali dalam bahasa Indonesia, mis. "Awal Desember 2026"; null = tidak ada */
  returns: string | null;
  returnsRaw: string | null;
  /** tanggal perkiraan kembali bila teksnya bisa dibaca */
  returnIso: string | null;
  kind: InjuryKind;
}

export interface InjuryResponse {
  players: InjuredPlayer[];
  /** jumlah pemain skuad yang berhasil diperiksa / gagal */
  checked: number;
  failed: number;
  updatedAt: string;
}

/* ---------- terjemahan & tanggal ---------- */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const monthIdx = (w: string) => MONTHS.findIndex((m) => m === w.toLowerCase() || m.slice(0, 3) === w.toLowerCase().slice(0, 3));

const BODY: [RegExp, string][] = [
  [/hamstring/i, 'otot paha belakang (hamstring)'],
  [/quadricep/i, 'paha depan (quadriceps)'],
  [/thigh/i, 'paha'],
  [/groin/i, 'pangkal paha'],
  [/calf/i, 'betis'],
  [/achilles/i, 'tendon Achilles'],
  [/ankle/i, 'pergelangan kaki'],
  [/knee|acl|cruciate|meniscus/i, 'lutut'],
  [/foot|toe/i, 'kaki'],
  [/hip/i, 'pinggul'],
  [/back/i, 'punggung'],
  [/shoulder/i, 'bahu'],
  [/concussion|head/i, 'kepala (gegar otak)'],
  [/illness|sick|flu|virus/i, 'sakit'],
  [/muscle|muscular/i, 'otot'],
  [/knock/i, 'benturan'],
  [/fracture|broken/i, 'patah tulang'],
  [/surgery/i, 'pasca operasi'],
  [/unknown|undisclosed/i, 'jenis belum dikonfirmasi'],
];

export function injuryId(raw: string): string {
  const hit = BODY.find(([re]) => re.test(raw));
  return hit ? hit[1][0].toUpperCase() + hit[1].slice(1) : raw;
}

const QUAL: Record<string, string> = { early: 'Awal', mid: 'Pertengahan', late: 'Akhir', end: 'Akhir', start: 'Awal' };

/** "Early December 2026" → "Awal Desember 2026"; teks yang tidak dikenal dikembalikan apa adanya. */
export function returnId(raw: string): string {
  const t = raw.trim();
  if (!t || /^(unknown|tbc|tba)$/i.test(t)) return 'TBC';
  if (/doubtful/i.test(t)) return 'Diragukan';
  return t
    .replace(/\b(early|mid|late|end|start)\b[-\s]*/gi, (_, q: string) => `${QUAL[q.toLowerCase()]} `)
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, (m) => MONTHS_ID[monthIdx(m)])
    .replace(/\b(jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b\.?/gi, (m) => MONTHS_ID[monthIdx(m)])
    .replace(/\s+/g, ' ')
    .trim();
}

/** Perkiraan tanggal dari teks FotMob. Tahun tak disebut = kemunculan berikutnya (paling lama 2 bulan ke belakang). */
export function parseReturn(raw: string | null, now: Date): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3])).toISOString();
  const m = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.exec(t);
  if (!m) return null;
  const month = monthIdx(m[1]);
  const day = /\b(\d{1,2})\b(?!\s*\d{3})/.exec(t.replace(/\b\d{4}\b/, ''));
  const qual = /early|start/i.test(t) ? 5 : /late|end/i.test(t) ? 25 : 15;
  const d = day ? Math.min(31, Number(day[1])) : qual;
  const yr = /\b(20\d{2})\b/.exec(t);
  let year = yr ? Number(yr[1]) : now.getUTCFullYear();
  let at = Date.UTC(year, month, d);
  if (!yr && at < now.getTime() - 60 * 86400000) at = Date.UTC(year + 1, month, d);
  return new Date(at).toISOString();
}

const SOON_DAYS = 21;

export function classify(injuryRaw: string, returnsRaw: string | null, returnIso: string | null, now: Date): InjuryKind {
  if (/doubt|knock|minor|fitness|precaution/i.test(`${injuryRaw} ${returnsRaw ?? ''}`)) return 'diragukan';
  if (!returnIso) return 'absen';
  const days = (new Date(returnIso).getTime() - now.getTime()) / 86400000;
  return days <= SOON_DAYS ? 'segera' : 'lama';
}

/* ---------- pengambilan ---------- */

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; bianconeri-matchday-hub)',
};

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 1800 }, signal: AbortSignal.timeout(10000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchInjuries(now = new Date()): Promise<InjuryResponse> {
  const { players } = await fetchFotmob();
  const out: InjuredPlayer[] = [];
  let failed = 0;
  let checked = 0;

  // 6 permintaan sekaligus supaya tidak membebani FotMob
  for (let i = 0; i < players.length; i += 6) {
    const batch = players.slice(i, i + 6);
    const res = await Promise.all(batch.map((p) => getJson(`https://www.fotmob.com/api/data/playerData?id=${encodeURIComponent(p.id)}`)));
    batch.forEach((p, k) => {
      const detail = res[k] ? parsePlayerData(res[k], p.id) : null;
      if (!detail) {
        failed += 1;
        return;
      }
      checked += 1;
      if (!detail.injury) return;
      const injuryRaw = detail.injury.name;
      const returnsRaw = detail.injury.returns;
      const returnIso = parseReturn(returnsRaw, now);
      out.push({
        id: p.id,
        name: p.name,
        jersey: p.jersey,
        photo: p.photo,
        position: detail.position ?? p.position,
        injury: injuryId(injuryRaw),
        injuryRaw,
        returns: returnsRaw ? returnId(returnsRaw) : null,
        returnsRaw,
        returnIso,
        kind: classify(injuryRaw, returnsRaw, returnIso, now),
      });
    });
  }

  const order: Record<InjuryKind, number> = { lama: 0, absen: 1, diragukan: 2, segera: 3 };
  out.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
  return { players: out, checked, failed, updatedAt: now.toISOString() };
}
