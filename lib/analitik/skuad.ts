// Analitik → 11 Profil skuad: murni fungsi (tanpa fetch), jadi gampang diuji.
// Menit per pemain = jumlah menit di semua laga resmi (FotMob lineup). Usia, negara, dan status akademi dari FotMob playerData.
// Usia dihitung per hari ini (bukan saat laga) dan dibobot menit bermain.

export interface PlayerMinutes {
  id: string;
  name: string;
  minutes: number;
  /** tanggal lahir YYYY-MM-DD; null bila FotMob tidak memberi */
  birthIso: string | null;
  /** negara pemain (nama Inggris dari FotMob); null bila tidak ada */
  country: string | null;
  /** pernah bermain di jenjang usia / Next Gen Juventus; null = riwayat karier tidak bisa dibaca */
  academy: boolean | null;
}

export interface AgeBand {
  key: string;
  label: string;
  minutes: number;
  pct: number;
}

export interface CountryRow {
  country: string;
  minutes: number;
  pct: number;
}

export interface SkuadBody {
  /** pemain yang punya menit bermain */
  players: number;
  totalMinutes: number;
  /** usia rata-rata dibobot menit; null bila tanggal lahir tidak ada */
  avgAge: number | null;
  ageBands: AgeBand[];
  academy: { minutes: number; pct: number | null; /** pemain yang status akademinya diketahui */ known: number };
  countries: { count: number; list: CountryRow[] };
}

export interface SkuadResponse extends SkuadBody {
  warnings: string[];
  updatedAt: string;
}

const YOUTH_TEAM = /\bU-?\d{2}\b|next gen|primavera|youth|giovanili|under[\s-]?\d{2}/i;
const WOMEN = /women|femminile|\(w\)/i;

/**
 * Lulusan akademi = pernah tercatat di tim usia/Next Gen Juventus pada riwayat karier FotMob.
 * Pemain yang pindah ke Juventus saat remaja juga terhitung (mereka memang dibina di akademi Juventus).
 * Null bila FotMob tidak punya riwayat karier sama sekali; false bila riwayat ada tapi tanpa jenjang usia Juventus
 * (FotMob tidak selalu mencatat jenjang usia, jadi false bisa berarti "tidak tercatat").
 */
export function isAcademyGrad(data: any): boolean | null {
  const items = data?.careerHistory?.careerItems;
  if (!items || typeof items !== 'object') return null;
  let any = false;
  for (const [key, group] of Object.entries<any>(items)) {
    if (/national/i.test(key)) continue;
    const entries: any[] = Array.isArray(group?.teamEntries) ? group.teamEntries : [];
    for (const e of entries) {
      any = true;
      const team = String(e?.team ?? e?.teamName ?? '');
      if (!/juventus/i.test(team) || WOMEN.test(team)) continue;
      if (YOUTH_TEAM.test(team) || /youth/i.test(key)) return true;
    }
  }
  return any ? false : null;
}

/** Tanggal lahir YYYY-MM-DD dari nilai FotMob (utcTime atau string ISO); null bila tidak valid. */
export function birthOf(v: unknown): string | null {
  const s = String(v ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime()) ? s : null;
}

export const ageYears = (birthIso: string, now: Date) => (now.getTime() - new Date(birthIso).getTime()) / (365.2425 * 86400000);

const BANDS: { key: string; label: string; test: (a: number) => boolean }[] = [
  { key: 'u21', label: '≤ 21 th', test: (a) => a < 22 },
  { key: '22', label: '22–25 th', test: (a) => a >= 22 && a < 26 },
  { key: '26', label: '26–29 th', test: (a) => a >= 26 && a < 30 },
  { key: '30', label: '30+ th', test: (a) => a >= 30 },
];

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function aggregate(input: PlayerMinutes[], now = new Date()): SkuadBody {
  const rows = input.filter((p) => p.minutes > 0);
  const totalMinutes = rows.reduce((n, p) => n + p.minutes, 0);

  const aged = rows.filter((p) => p.birthIso).map((p) => ({ min: p.minutes, age: ageYears(p.birthIso as string, now) }));
  const ageMin = aged.reduce((n, p) => n + p.min, 0);
  const avgAge = ageMin > 0 ? Math.round((aged.reduce((n, p) => n + p.age * p.min, 0) / ageMin) * 10) / 10 : null;
  const ageBands: AgeBand[] = ageMin
    ? BANDS.map((b) => {
        const minutes = aged.filter((p) => b.test(Math.floor(p.age))).reduce((n, p) => n + p.min, 0);
        return { key: b.key, label: b.label, minutes, pct: pct(minutes, ageMin) };
      })
    : [];

  const known = rows.filter((p) => p.academy != null);
  const knownMin = known.reduce((n, p) => n + p.minutes, 0);
  const acaMin = known.filter((p) => p.academy).reduce((n, p) => n + p.minutes, 0);

  const byCountry = new Map<string, number>();
  for (const p of rows) if (p.country) byCountry.set(p.country, (byCountry.get(p.country) ?? 0) + p.minutes);
  const countryMin = [...byCountry.values()].reduce((n, v) => n + v, 0);
  const list = [...byCountry.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([country, minutes]) => ({ country, minutes, pct: pct(minutes, countryMin) }));

  return {
    players: rows.length,
    totalMinutes,
    avgAge,
    ageBands,
    academy: { minutes: acaMin, pct: knownMin > 0 ? pct(acaMin, knownMin) : null, known: known.length },
    countries: { count: byCountry.size, list },
  };
}
