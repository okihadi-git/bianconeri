// Pembantu kecil yang dipakai bersama oleh semua tab Analisa (aman di server maupun browser: tanpa impor apa pun).

export const DASH = '–';

export const r1 = (n: number) => Math.round(n * 10) / 10;
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Poin dari satu pertandingan menurut skor akhir (adu penalti dihitung seri). */
export const pointsOf = (gf: number, ga: number) => (gf > ga ? 3 : gf === ga ? 1 : 0);

/** "67'" → 67, "90'+3'" → 90, kosong → null */
export function minuteOf(raw: string): number | null {
  const m = /^(\d+)/.exec(String(raw ?? '').trim());
  return m ? Number(m[1]) : null;
}

/** Angka berkoma Indonesia; null/undefined → "–". */
export const dec = (n: number | null | undefined, digits = 2) => (n == null ? DASH : n.toFixed(digits).replace('.', ','));

/** "+0,64" / "−0,17" (tanda minus sebenarnya) / "0,00". */
export const signed = (n: number, digits = 2) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${dec(Math.abs(n), digits)}`;

/** Bilangan bulat dengan pemisah ribuan titik: 15843 → "15.843". */
export const int = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
