// Gaji pemain: tipe dan pencarian (murni, aman dipakai di komponen klien).
// Datanya diambil server dari Supabase lewat lib/salaries-server.ts dan disajikan /api/gaji.
import { findPlayer } from './names';

export interface Salary {
  name: string;
  /** gaji kotor per tahun, euro */
  eurPerYear: number;
  /** sumber angka, mis. "SalaryLeaks 2026"; boleh kosong */
  source: string;
}

export interface SalaryResponse {
  salaries: Salary[];
  updatedAt: string;
}

/** "Bremer" cocok dengan "Gleison Bremer" (logika yang sama dengan foto pemain). */
export function salaryFrom(list: Salary[] | null | undefined, name: string): Salary | null {
  return list?.length ? findPlayer(name, list) : null;
}
