// "Siap naik ke tim utama?": indeks gabungan 0–100 untuk pemain akademi. Buatan Matchday Hub, BUKAN penilaian klub.
// Komponen (bobot): rating FotMob (35) · menit bermain (30) · gol+assist per 90 menit (25) · usia muda (10).
// Komponen yang datanya tidak ada (mis. rating di liga kecil) dilewati dan bobot sisanya dinormalisasi ulang.
import type { PerfRow } from './akademi-stats';

export const MIN_MINUTES = 180;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Rating 6,4 = 0 poin, 8,0 = penuh. */
const ratingPart = (r: number) => clamp01((r - 6.4) / (8.0 - 6.4));
/** Gol + assist per 90 menit; 1,2 dianggap penuh. */
const contributionPart = (g: number, a: number, minutes: number) => clamp01(((g + a) / minutes) * 90 / 1.2);
const AGE_PART: Record<number, number> = { 15: 1, 16: 1, 17: 1, 18: 0.8, 19: 0.6, 20: 0.4, 21: 0.2 };
const agePart = (age: number) => (age <= 17 ? 1 : AGE_PART[age] ?? 0);

export interface Readiness {
  row: PerfRow;
  age: number | null;
  score: number;
}

/**
 * `teamMatches` = jumlah laga tim yang datanya terbaca; menit dibandingkan dengan 90 × jumlah itu.
 * Hanya pemain dengan ≥ 180 menit. Hasil urut dari skor tertinggi.
 */
export function readiness(rows: PerfRow[], ages: Map<string, number | null>, teamMatches: number): Readiness[] {
  const out: Readiness[] = [];
  for (const row of rows) {
    if (row.minutes < MIN_MINUTES) continue;
    const age = ages.get(row.id) ?? null;
    const parts: [number, number][] = [
      [30, clamp01(row.minutes / Math.max(1, teamMatches * 90))],
      [25, contributionPart(row.goals, row.assists, row.minutes)],
    ];
    if (row.rating != null) parts.push([35, ratingPart(row.rating)]);
    if (age != null) parts.push([10, agePart(age)]);
    const w = parts.reduce((n, [x]) => n + x, 0);
    out.push({ row, age, score: Math.round((parts.reduce((n, [x, c]) => n + x * c, 0) / w) * 100) });
  }
  return out.sort((a, b) => b.score - a.score || b.row.minutes - a.row.minutes);
}
