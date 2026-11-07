// Membaca tabel gaji dari Supabase (REST/PostgREST) — hanya dari server. Kunci tidak pernah dikirim ke browser.
//
// Hemat kuota: seluruh tabel diambil dalam SATU request, hasilnya disimpan di cache data Next selama
// REVALIDATE detik, dan /api/gaji disajikan dari cache CDN. Berapa pun jumlah pengunjung, Supabase hanya
// dihubungi paling banyak sekitar sekali per jendela cache per instance. Bila Supabase gagal, Next tetap
// menyajikan salinan lama yang masih tersimpan.
import type { Salary } from './salaries';

export const REVALIDATE = 6 * 60 * 60; // gaji jarang berubah: 6 jam

// Sesuaikan dengan nama tabel/kolom di Supabase kamu (atau atur lewat env).
const TABLE = process.env.SUPABASE_SALARY_TABLE || 'salaries';
const COL = {
  name: process.env.SUPABASE_SALARY_COL_NAME || 'player_name',
  eurPerYear: process.env.SUPABASE_SALARY_COL_EUR_YEAR || 'eur_per_year',
  source: process.env.SUPABASE_SALARY_COL_SOURCE || 'source',
};

/** Ubah baris mentah Supabase menjadi Salary; baris yang angkanya tidak valid dibuang. */
export function parseSalaryRows(rows: unknown): Salary[] {
  if (!Array.isArray(rows)) return [];
  const out: Salary[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const name = String(r?.[COL.name] ?? '').trim();
    const eur = Number(r?.[COL.eurPerYear]);
    if (!name || !Number.isFinite(eur) || eur <= 0) continue;
    out.push({ name, eurPerYear: Math.round(eur), source: String(r?.[COL.source] ?? '').trim() });
  }
  return out;
}

/** null = Supabase belum dikonfigurasi atau gagal (pemanggil menampilkan "–", tidak ada angka karangan). */
export async function fetchSalaries(): Promise<Salary[] | null> {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;

  const select = [COL.name, COL.eurPerYear, COL.source].join(',');
  try {
    const res = await fetch(`${url}/rest/v1/${encodeURIComponent(TABLE)}?select=${encodeURIComponent(select)}&limit=500`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? parseSalaryRows(await res.json()) : null;
  } catch {
    return null;
  }
}
