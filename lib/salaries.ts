// Gaji pemain: tipe dan pencarian (murni, aman dipakai di komponen klien).
// Datanya diambil server dari tabel Supabase `player_salaries` (lib/salaries-server.ts) dan disajikan /api/gaji.
import { sameNameStrict } from './names';

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

/** ID pemain menurut jenisnya. ID Transfermarkt dan FotMob dibandingkan HANYA dengan kolomnya sendiri (tm_id / fotmob_id). */
export interface SalaryIds {
  tm?: string | null;
  fotmob?: string | null;
}

/**
 * Cari gaji satu pemain.
 *  1. ID: tm_id atau fotmob_id sama persis → langsung dipakai (ID satu sumber tidak bisa bertabrakan dengan dirinya sendiri,
 *     jadi nama yang ditulis berbeda, mis. "Nico" vs "Nicolás", tidak jadi masalah).
 *  2. Tanpa ID: nama harus cocok ketat dan hanya satu kandidat. Lebih baik kosong daripada gaji orang lain.
 */
export function salaryFrom(list: Salary[] | null | undefined, who: { name: string; ids?: SalaryIds }): Salary | null {
  if (!list?.length) return null;
  const tm = who.ids?.tm ? String(who.ids.tm) : '';
  const fm = who.ids?.fotmob ? String(who.ids.fotmob) : '';
  const byId = list.find((s) => (tm && s.tmId === tm) || (fm && s.fotmobId === fm));
  if (byId) return byId;
  const named = list.filter((s) => sameNameStrict(s.name, who.name));
  return named.length === 1 ? named[0] : null;
}
