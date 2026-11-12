// Bagian "Kesulitan jadwal" yang aman dipakai di browser (tanpa impor kode server).
import type { JTeam } from './jadwal';

export type Level = 'mudah' | 'sedang' | 'berat';

/** Batas kesulitan menurut xPts per laga: Mudah ≥ 2,1 · Sedang 1,5–2,1 · Berat < 1,5. */
export const EASY_AT = 2.1;
export const HARD_BELOW = 1.5;
export const levelOf = (xpts: number): Level => (xpts >= EASY_AT ? 'mudah' : xpts >= HARD_BELOW ? 'sedang' : 'berat');
export const LEVEL_LABEL: Record<Level, string> = { mudah: 'Mudah', sedang: 'Sedang', berat: 'Berat' };

/** Rival bawaan: tim di peringkat tepat di atas; bila sudah #1, tim di bawahnya. */
export function defaultRival(teams: JTeam[], mine: string): string {
  const sorted = [...teams].sort((a, b) => a.position - b.position);
  const i = sorted.findIndex((t) => t.id === mine);
  if (i < 0) return sorted[0]?.id ?? '';
  return (i > 0 ? sorted[i - 1] : sorted[i + 1] ?? sorted[i]).id;
}
