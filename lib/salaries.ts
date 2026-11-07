// Gaji pemain: tipe dan pencarian (murni, aman dipakai di komponen klien).
// Datanya diambil server dari tabel Supabase `player_salaries` (lib/salaries-server.ts) dan disajikan /api/gaji.
import { normName } from './names';

/** Nama sama persis, atau semua kata nama yang lebih pendek ada di nama yang lebih panjang (tanpa tebakan nama belakang). */
const sameNameStrict = (a: string, b: string) => {
  const [x, y] = [normName(a), normName(b)];
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length > 0 && short.every((w) => long.includes(w));
};

export interface Salary {
  name: string;
  tmId: string | null;
  fotmobId: string | null;
  /** gaji tetap kotor, euro */
  fixedPerWeek: number | null;
  fixedPerYear: number | null;
  bonusPerYear: number | null;
  /** tetap + bonus, per tahun */
  totalPerYear: number | null;
  /** kontrak menurut tabel, ISO "YYYY-MM-DD" */
  signed: string | null;
  expiration: string | null;
  releaseClause: number | null;
  status: string | null;
  source: string;
}

export interface SalaryResponse {
  salaries: Salary[];
  updatedAt: string;
}

/** Gaji tetap per tahun bila ada, kalau tidak total per tahun, kalau tidak 52 × per pekan. */
export const yearlyOf = (s: Salary): number | null => s.totalPerYear ?? s.fixedPerYear ?? (s.fixedPerWeek != null ? s.fixedPerWeek * 52 : null);
export const weeklyOf = (s: Salary): number | null => s.fixedPerWeek ?? (s.fixedPerYear != null ? s.fixedPerYear / 52 : null);

/**
 * Cari gaji satu pemain. ID (Transfermarkt/FotMob) hanya dipakai bila namanya juga cocok — rentang ID kedua sumber
 * bisa bertabrakan; tanpa ID, nama harus cocok ketat ("Bremer" ↔ "Gleison Bremer", bukan sekadar nama belakang sama).
 */
export function salaryFrom(list: Salary[] | null | undefined, who: { name: string; ids?: (string | null | undefined)[] }): Salary | null {
  if (!list?.length) return null;
  const ids = (who.ids ?? []).filter(Boolean).map(String);
  if (ids.length) {
    const byId = list.filter((s) => ids.includes(String(s.tmId)) || ids.includes(String(s.fotmobId)));
    const hit = byId.find((s) => sameNameStrict(s.name, who.name));
    if (hit) return hit;
  }
  // Tanpa ID: nama harus cocok ketat dan hanya satu kandidat. Lebih baik kosong daripada gaji orang lain.
  const named = list.filter((s) => sameNameStrict(s.name, who.name));
  return named.length === 1 ? named[0] : null;
}
