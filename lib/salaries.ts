// Gaji pemain (opsional). Tidak ada sumber gratis yang stabil untuk gaji pemain, jadi daftar ini DIISI MANUAL
// dan sengaja kosong secara bawaan: pemain yang tidak ada di sini tampil "–" (tidak diisi angka karangan).
//
// Cara mengisi: nama pemain (boleh nama pendek seperti di skuad) → gaji kotor per tahun dalam EURO,
// plus sumbernya supaya bisa ditelusuri. Contoh (angka hanya ilustrasi format, bukan data):
//
//   'Contoh Pemain': { eurPerYear: 5_000_000, source: 'SalaryLeaks, 2026' },
//
// Pencocokan nama memakai logika yang sama dengan foto pemain (findPlayer), jadi "Bremer" cocok dengan "Gleison Bremer".
import { findPlayer } from './names';

export interface Salary {
  eurPerYear: number;
  source: string;
}

const SALARIES: Record<string, Salary> = {};

export function salaryOf(name: string): Salary | null {
  const hit = findPlayer(name, Object.keys(SALARIES).map((n) => ({ name: n })));
  return hit ? SALARIES[hit.name] : null;
}
