// Membaca tabel `player_salaries` dari Supabase (REST/PostgREST) — hanya dari server; kunci tidak dikirim ke browser.
//
// Hemat kuota: seluruh tabel diambil dalam SATU request, disimpan di cache data Next selama REVALIDATE detik,
// dan /api/gaji disajikan dari cache CDN. Berapa pun jumlah pengunjung, Supabase hanya dihubungi sekitar sekali
// per jendela cache. Bila Supabase gagal, Next tetap menyajikan salinan lama yang masih tersimpan.
import type { Salary } from './salaries';

export const REVALIDATE = 6 * 60 * 60; // gaji jarang berubah: 6 jam

const TABLE = process.env.SUPABASE_SALARY_TABLE || 'player_salaries';
const COLUMNS = [
  'name', 'tm_id', 'fotmob_id', 'gross_fixed_per_week_eur', 'gross_fixed_per_year_eur', 'gross_bonus_per_year_eur',
  'gross_total_per_year_eur', 'status', 'signed', 'expiration', 'release_clause_eur', 'source', 'created_at',
];

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const text = (v: unknown) => (v == null ? null : String(v).trim() || null);
const day = (v: unknown) => (/^\d{4}-\d{2}-\d{2}/.test(String(v ?? '')) ? String(v).slice(0, 10) : null);

/** Baris Supabase → Salary. Bila satu pemain punya beberapa baris, yang created_at-nya terbaru dipakai. */
export function parseSalaryRows(rows: unknown): Salary[] {
  if (!Array.isArray(rows)) return [];
  const latest = new Map<string, { at: string; s: Salary }>();
  for (const r of rows as Record<string, unknown>[]) {
    const name = text(r?.name);
    if (!name) continue;
    const s: Salary = {
      name,
      tmId: text(r.tm_id),
      fotmobId: text(r.fotmob_id),
      fixedPerWeek: num(r.gross_fixed_per_week_eur),
      fixedPerYear: num(r.gross_fixed_per_year_eur),
      bonusPerYear: num(r.gross_bonus_per_year_eur),
      totalPerYear: num(r.gross_total_per_year_eur),
      signed: day(r.signed),
      expiration: day(r.expiration),
      releaseClause: num(r.release_clause_eur),
      status: text(r.status),
      source: text(r.source) ?? '',
    };
    // baris tanpa satu pun angka gaji tidak berguna
    if (s.fixedPerWeek == null && s.fixedPerYear == null && s.totalPerYear == null) continue;
    const key = s.fotmobId ?? s.tmId ?? name.toLowerCase();
    const at = String(r.created_at ?? '');
    const prev = latest.get(key);
    if (!prev || at > prev.at) latest.set(key, { at, s });
  }
  return [...latest.values()].map((v) => v.s);
}

/** null = Supabase belum dikonfigurasi atau gagal (pemanggil menampilkan "–", tidak ada angka karangan). */
export async function fetchSalaries(): Promise<Salary[] | null> {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${encodeURIComponent(TABLE)}?select=${COLUMNS.join(',')}&order=created_at.desc&limit=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? parseSalaryRows(await res.json()) : null;
  } catch {
    return null;
  }
}
