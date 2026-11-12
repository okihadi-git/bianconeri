// Susunan pemain di lapangan, mengikuti data ESPN.
//   - Baris (garis) ditentukan dari singkatan posisi tiap pemain di ESPN (G, CD-L, DM, AM-R, F, ...).
//   - Formasi ESPN (mis. 4-2-3-1) dipakai sebagai pemeriksa: kalau jumlah pemain per baris dari posisi sama
//     dengan formasi, dipakai apa adanya; kalau tidak cocok, pemain dibagi mengikuti urutan formationPlace ESPN.
//   - Urutan kiri → kanan dalam satu baris memakai penanda L/R pada posisi (CD-L, LB, RM, AM-R, ...).
// Murni fungsi, tanpa fetch; dipakai tab Skor live dan popup rating supaya keduanya konsisten.

export interface PitchPlayer {
  position: string;
}

/** Kedalaman garis: 0 kiper … 5 penyerang. */
export function depthOf(abbr: string): number {
  const a = String(abbr ?? '').toUpperCase().trim();
  if (/^G/.test(a)) return 0;
  if (/^(DM|CDM)/.test(a)) return 2;
  if (/^(CD|CB|SW|LB|RB|D$|LWB|RWB|WB)/.test(a)) return 1;
  if (/^AM|^CAM/.test(a)) return 4;
  if (/^(F|CF|ST|SS|LF|RF|LW|RW|W)/.test(a)) return 5;
  return 3; // CM, LM, RM, M, dan posisi tak dikenal
}

/**
 * Posisi kiri → kanan: ±2 = sisi terluar (LB, RWB, LM, RW), ±1 = sisi dalam (CD-L, CM-R, AM-L, LF), 0 = tengah.
 * Nilai pecahan ini perlu supaya bek sayap tidak tertukar dengan bek tengah sisi yang sama.
 */
export function lateralOf(abbr: string): number {
  const parts = String(abbr ?? '').toUpperCase().trim().split('-');
  const head = parts[0];
  if (head.startsWith('G')) return 0;
  if (parts.includes('L')) return -1;
  if (parts.includes('R')) return 1;
  if (/^[LR]F$/.test(head)) return head[0] === 'L' ? -1 : 1;
  if (/^L[A-Z]/.test(head)) return -2;
  if (/^R[A-Z]/.test(head)) return 2;
  return 0;
}

const parseFormation = (f: string): number[] => {
  const digits = String(f ?? '')
    .trim()
    .split('-')
    .map(Number);
  return digits.length >= 2 && digits.every((n) => Number.isInteger(n) && n > 0) ? digits : [];
};

/**
 * `starters` harus urut formationPlace (indeks 0 biasanya kiper).
 * Hasil: baris-baris, kiper dulu lalu bertahan → menyerang, tiap baris urut kiri → kanan.
 * `mirror` = true membalik kiri/kanan (untuk tim yang digambar menghadap ke penonton).
 */
export function layoutLines<T extends PitchPlayer>(starters: T[], formation: string, mirror = false): T[][] {
  if (!starters.length) return [];
  const gkIdx = Math.max(0, starters.findIndex((p) => depthOf(p.position) === 0));
  const gk = starters[gkIdx];
  const rest = starters.filter((_, i) => i !== gkIdx);
  const digits = parseFormation(formation);
  const formationOk = digits.length > 0 && digits.reduce((a, b) => a + b, 0) === rest.length;

  // 1) baris dari posisi ESPN
  const byDepth = new Map<number, T[]>();
  for (const p of rest) byDepth.set(depthOf(p.position), [...(byDepth.get(depthOf(p.position)) ?? []), p]);
  const positional = [...byDepth.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list);

  // 2) baris dari formasi + urutan formationPlace
  const sliced: T[][] = [];
  if (formationOk) {
    let at = 0;
    for (const n of digits) {
      sliced.push(rest.slice(at, at + n));
      at += n;
    }
  }

  const matches = formationOk && positional.length === digits.length && positional.every((r, i) => r.length === digits[i]);
  const lines = matches ? positional : formationOk ? sliced : positional;

  const sign = mirror ? -1 : 1;
  const ordered = lines.map((row) => {
    const keys = row.map((p) => lateralOf(p.position));
    if (new Set(keys).size < 2) return row;
    return [...row].sort((a, b) => sign * (lateralOf(a.position) - lateralOf(b.position)));
  });
  return [[gk], ...ordered];
}
