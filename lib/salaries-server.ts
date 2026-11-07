// Membaca tabel `player_salaries` dari Supabase (REST/PostgREST) — hanya dari server; kunci tidak dikirim ke browser.
//
// Hemat kuota: seluruh tabel diambil dalam SATU request dan /api/gaji disajikan dari cache CDN selama REVALIDATE detik
// (hanya bila datanya ada). Berapa pun jumlah pengunjung, Supabase hanya dihubungi sekitar sekali per jendela cache.
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

export interface SalaryResult {
  salaries: Salary[];
  /** diisi bila salaries kosong: alasannya, untuk pelacakan. Tidak memuat kunci atau data rahasia. */
  reason?: string;
}

/**
 * Hasil + alasan bila kosong. Hasil kosong/gagal sengaja TIDAK disimpan di cache data Next (cache: 'no-store'):
 * kalau tidak, kesalahan sementara (env belum terisi, RLS belum diatur) akan tertahan berjam-jam. Penghematan kuota
 * dilakukan di cache CDN lewat header di /api/gaji, yang hanya panjang saat datanya ada.
 */
export async function fetchSalariesDetailed(): Promise<SalaryResult> {
  // Nama env yang diterima: SUPABASE_URL / SUPABASE_KEY, atau NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) {
    const missing = [!url && 'SUPABASE_URL (atau NEXT_PUBLIC_SUPABASE_URL)', !key && 'SUPABASE_KEY (atau NEXT_PUBLIC_SUPABASE_ANON_KEY)'].filter(Boolean).join(' dan ');
    return { salaries: [], reason: `${missing} belum terbaca di server. Isi di Vercel (Settings → Environment Variables), lalu Redeploy.` };
  }
  try {
    const res = await fetch(`${url}/rest/v1/${encodeURIComponent(TABLE)}?select=${COLUMNS.join(',')}&order=created_at.desc&limit=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const body: any = await res.json().catch(() => null);
    if (!res.ok) return { salaries: [], reason: `Supabase menjawab HTTP ${res.status}: ${String(body?.message ?? body?.hint ?? 'tanpa pesan').slice(0, 200)}` };
    if (!Array.isArray(body) || body.length === 0) {
      return { salaries: [], reason: `Tabel "${TABLE}" terbaca kosong. Biasanya tabel memang belum diisi (impor CSV), atau RLS aktif tanpa policy select untuk kunci ini.` };
    }
    const salaries = parseSalaryRows(body);
    return salaries.length ? { salaries } : { salaries: [], reason: `${body.length} baris terbaca, tetapi tidak ada yang punya angka gaji valid (kolom gross_* kosong/0).` };
  } catch (e) {
    return { salaries: [], reason: `Gagal menghubungi Supabase: ${e instanceof Error ? e.message : 'tidak diketahui'}` };
  }
}

/** Daftar gaji, atau null bila belum tersedia (pemanggil menampilkan "–", tidak ada angka karangan). */
export async function fetchSalaries(): Promise<Salary[] | null> {
  const r = await fetchSalariesDetailed();
  return r.salaries.length ? r.salaries : null;
}
