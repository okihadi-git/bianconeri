// Detail satu pemain untuk popup di halaman Skuad.
//   1. FotMob playerData  — tanggal lahir, tinggi, riwayat klub, caps timnas, rating 10 laga terakhir, cedera
//   2. Wikidata           — tempat lahir (hanya dipakai bila tanggal lahirnya cocok dengan FotMob, jadi tidak salah orang)
// Kedua sumber tidak resmi dan formatnya bisa berubah. Fungsi di sini tidak pernah melempar error ke pemanggil:
// bagian yang tidak diberikan sumber bernilai null / kosong, tidak pernah diisi tebakan.
import { findPlayer, juveSquadPool } from './fotmob';

export interface ClubStint {
  team: string;
  /** "2019-2025", "2021", "2019-" (masih berjalan) */
  years: string;
  startYear: number | null;
  loan: boolean;
  current: boolean;
}

export interface FormEntry {
  id: string;
  iso: string;
  /** 3 huruf, mis. "AST" */
  opp: string;
  oppName: string;
  competition: string;
  rating: number | null;
  minutes: number;
}

export interface PlayerDetail {
  /** id pemain di FotMob */
  id: string;
  name: string;
  birth: { iso: string | null; place: string | null };
  heightCm: number | null;
  /** negara dari FotMob (Inggris) */
  country: string | null;
  position: string | null;
  marketValue: number | null;
  clubs: ClubStint[];
  /** tahun & klub asal, dari riwayat klub */
  joined: { year: number | null; from: string | null } | null;
  nationalTeam: { team: string; caps: number | null; goals: number | null } | null;
  injury: { name: string; returns: string | null } | null;
  /** rating resmi FotMob, urut lama → baru */
  form: FormEntry[];
  updatedAt: string;
}

/* ---------- util kecil ---------- */

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const yearOf = (v: unknown): number | null => {
  const m = /(\d{4})/.exec(str(v));
  return m ? Number(m[1]) : null;
};
const isoOf = (v: unknown): string | null => {
  const t = new Date(str(v)).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** 3 huruf untuk lawan: "Aston Villa" → "AST", "Man City" → "MAN" */
export function oppAbbr(name: string): string {
  const letters = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z\s]/g, '')
    .trim();
  return letters.replace(/\s+/g, '').slice(0, 3).toUpperCase();
}

/* ---------- FotMob ---------- */

/** Cari baris di playerInformation berdasarkan judul/kunci terjemahan (mis. "height", "country"). */
function infoRow(data: any, key: string): any | null {
  const rows: any[] = Array.isArray(data?.playerInformation) ? data.playerInformation : [];
  return rows.find((r) => `${r?.title ?? ''} ${r?.translationKey ?? ''}`.toLowerCase().includes(key)) ?? null;
}

const rowText = (r: any) => str(r?.value?.fallback ?? r?.value?.key ?? '');
const rowNum = (r: any) => num(r?.value?.numberValue);

/** Entri riwayat klub FotMob → daftar urut lama → baru dengan tahun mulai & selesai. */
export function parseClubs(entries: any[]): ClubStint[] {
  const rows = entries
    .map((e) => ({
      team: str(e?.team ?? e?.teamName),
      start: yearOf(e?.startDate),
      end: yearOf(e?.endDate),
      active: Boolean(e?.active),
      loan: /loan/i.test(str(e?.transferType?.text ?? e?.transferType ?? '')),
    }))
    .filter((r) => r.team);

  // Urut lama → baru. FotMob umumnya mengurutkan baru → lama, jadi balik bila tanggalnya tidak tersedia.
  const dated = rows.every((r) => r.start != null);
  const ordered = dated ? [...rows].sort((a, b) => (a.start as number) - (b.start as number)) : [...rows].reverse();

  return ordered.map((r, i) => {
    const next = ordered[i + 1];
    const end = r.active ? null : r.end ?? next?.start ?? null;
    const years = r.start == null ? '' : r.active ? `${r.start}-` : end == null || end === r.start ? String(r.start) : `${r.start}-${end}`;
    return { team: r.team, years, startYear: r.start, loan: r.loan, current: r.active };
  });
}

export function parseJoined(clubs: ClubStint[]): PlayerDetail['joined'] {
  const idx = clubs.findIndex((c) => c.current && !c.loan);
  const cur = idx >= 0 ? clubs[idx] : null;
  if (!cur) return null;
  return { year: cur.startYear, from: idx > 0 ? clubs[idx - 1].team : null };
}

/** Timnas senior = entri tim nasional pertama yang bukan U-xx. */
export function parseNational(data: any): PlayerDetail['nationalTeam'] {
  const items = data?.careerHistory?.careerItems;
  const entries: any[] = items?.['national team']?.teamEntries ?? items?.nationalTeam?.teamEntries ?? [];
  const senior = entries.find((e) => !/\bU-?\d{2}\b|olympic/i.test(str(e?.team ?? e?.teamName)));
  if (!senior) return null;
  return { team: str(senior.team ?? senior.teamName), caps: num(senior.appearances), goals: num(senior.goals) };
}

export function parseForm(data: any): FormEntry[] {
  const list: any[] = Array.isArray(data?.recentMatches) ? data.recentMatches : [];
  const out: FormEntry[] = [];
  for (const m of list) {
    const iso = isoOf(m?.matchDate?.utcTime ?? m?.matchDate);
    if (!iso) continue;
    const rating = num(m?.ratingProps?.num ?? m?.rating?.num ?? m?.rating);
    const minutes = num(m?.minutesPlayed) ?? 0;
    if (rating == null && minutes <= 0) continue; // tidak bermain
    const oppName = str(m?.opponentTeamName);
    out.push({
      id: str(m?.id),
      iso,
      opp: oppAbbr(oppName),
      oppName,
      competition: str(m?.leagueName),
      rating: rating != null && rating > 0 ? Math.round(rating * 10) / 10 : null,
      minutes,
    });
  }
  return out.sort((a, b) => a.iso.localeCompare(b.iso)).slice(-10);
}

export function parseInjury(data: any): PlayerDetail['injury'] {
  const inj = data?.injuryInformation;
  const name = str(inj?.name ?? inj?.injuryName);
  if (!name) return null;
  const back = str(inj?.expectedReturn?.expectedReturnFallback ?? inj?.expectedReturn?.expectedReturn ?? inj?.expectedReturn);
  return { name, returns: back || null };
}

export function parsePlayerData(data: any, id: string): PlayerDetail | null {
  const name = str(data?.name);
  if (!name) return null;
  const clubs = parseClubs(data?.careerHistory?.careerItems?.senior?.teamEntries ?? []);
  const mv = rowNum(infoRow(data, 'market'));
  const height = rowNum(infoRow(data, 'height'));
  return {
    id,
    name,
    birth: { iso: isoOf(data?.birthDate?.utcTime ?? data?.birthDate), place: null },
    heightCm: height && height > 0 ? Math.round(height) : null,
    country: rowText(infoRow(data, 'country')) || null,
    position: str(data?.positionDescription?.primaryPosition?.label) || null,
    marketValue: mv && mv > 0 ? mv : null,
    clubs,
    joined: parseJoined(clubs),
    nationalTeam: parseNational(data),
    injury: parseInjury(data),
    form: parseForm(data),
    updatedAt: new Date().toISOString(),
  };
}

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; bianconeri-matchday-hub)',
};

async function getJson(url: string, revalidate: number, headers: Record<string, string> = HEADERS): Promise<any | null> {
  try {
    const res = await fetch(url, { headers, next: { revalidate }, signal: AbortSignal.timeout(10000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/* ---------- Wikidata: tempat lahir ---------- */

const WD_UA = `bianconeri-matchday-hub/1.0 (fan project; ${process.env.WIKI_CONTACT || 'https://github.com/'})`;
const WD_HEADERS = { Accept: 'application/json', 'User-Agent': WD_UA };
const DAY = 86400;

const wd = (params: Record<string, string>) =>
  `https://www.wikidata.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;

const claimDate = (e: any) => String(e?.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time ?? '').slice(1, 11); // "+2001-03-24T…" → "2001-03-24"
const claimEntity = (e: any, prop: string) => e?.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value?.id as string | undefined;
const labelOf = (e: any) => String(e?.labels?.id?.value ?? e?.labels?.en?.value ?? '');

/**
 * "Bondy, Prancis". Kandidat Wikidata dipilih hanya bila tanggal lahirnya sama persis dengan tanggal dari FotMob;
 * tanpa tanggal lahir, atau tanpa kecocokan, hasilnya null (lebih baik kosong daripada salah orang).
 */
export async function fetchBirthPlace(name: string, birthIso: string | null): Promise<string | null> {
  if (!birthIso) return null;
  const day = birthIso.slice(0, 10);
  try {
    const found = await getJson(wd({ action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '5' }), DAY, WD_HEADERS);
    const ids: string[] = (found?.search ?? []).map((s: any) => String(s.id));
    if (!ids.length) return null;

    const ents = await getJson(wd({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims' }), DAY, WD_HEADERS);
    const person = ids.map((i) => ents?.entities?.[i]).find((e) => claimDate(e) === day);
    const placeId = claimEntity(person, 'P19');
    if (!placeId) return null;

    const place = await getJson(wd({ action: 'wbgetentities', ids: placeId, props: 'labels|claims', languages: 'id|en' }), DAY, WD_HEADERS);
    const pe = place?.entities?.[placeId];
    const countryId = claimEntity(pe, 'P17');
    let country = '';
    if (countryId) {
      const c = await getJson(wd({ action: 'wbgetentities', ids: countryId, props: 'labels', languages: 'id|en' }), DAY, WD_HEADERS);
      country = labelOf(c?.entities?.[countryId]);
    }
    const city = labelOf(pe);
    return [city, country].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}

/* ---------- gabungan ---------- */

/** Detail pemain Juventus berdasarkan nama. null bila FotMob tidak bisa dihubungi / pemain tidak ditemukan. */
export async function fetchPlayerDetail(name: string): Promise<PlayerDetail | null> {
  const pool = await juveSquadPool();
  const hit = findPlayer(name, pool);
  if (!hit) return null;

  const data = await getJson(`https://www.fotmob.com/api/data/playerData?id=${encodeURIComponent(hit.id)}`, 1800);
  const detail = data ? parsePlayerData(data, hit.id) : null;
  if (!detail) return null;

  detail.birth.place = await fetchBirthPlace(detail.name, detail.birth.iso);
  return detail;
}
