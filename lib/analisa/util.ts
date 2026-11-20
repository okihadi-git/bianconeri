// Format angka & helper kecil untuk tab Analisa. Murni fungsi, aman dipakai di server dan browser.

export const DASH = '–';

const nf = (d: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

/** Desimal gaya Indonesia: dec(1234.5, 1) → "1.234,5". Kosong → "–". */
export const dec = (n: number | null | undefined, digits = 1) => (ok(n) ? nf(digits).format(n) : DASH);

/** Bilangan bulat dengan pemisah ribuan: int(41000) → "41.000". Kosong → "–". */
export const int = (n: number | null | undefined) => (ok(n) ? nf(0).format(Math.round(n)) : DASH);

/** Dengan tanda: signed(1.25, 1) → "+1,3", signed(-0.4, 1) → "−0,4". Nol tanpa tanda. */
export function signed(n: number | null | undefined, digits = 1) {
  if (!ok(n)) return DASH;
  const body = nf(digits).format(Math.abs(n));
  const rounded = Number(Math.abs(n).toFixed(digits));
  return rounded === 0 ? body : `${n > 0 ? '+' : '−'}${body}`;
}

/** Bulatkan ke 1 desimal (tetap angka). */
export const r1 = (n: number) => Math.round(n * 10) / 10;

/** Menit dasar dari teks ESPN: "45'+2'" → 45, "90'+4'" → 90, "67'" → 67. Tidak terbaca → null. */
export function minuteOf(s: string | null | undefined): number | null {
  const m = /(\d+)/.exec(String(s ?? ''));
  return m ? Number(m[1]) : null;
}

/** Poin dari skor: menang 3, seri 1, kalah 0. */
export const pointsOf = (gf: number, ga: number) => (gf > ga ? 3 : gf === ga ? 1 : 0);
