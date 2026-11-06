// Susunan pemain di lapangan, dihitung dari data ESPN saja (formasi + kode posisi + nomor formasi).
// Murni fungsi tanpa fetch, aman dipakai di server maupun komponen klien.
//
// Kenapa tidak cukup memotong daftar pemain per angka formasi: urutan `formationPlace` ESPN tidak selalu
// mengikuti garis formasi (kadang mengikuti penomoran tradisional: 2 bek kanan, 3 bek kiri, 6 gelandang bertahan, ...).
// Jadi pemain diurutkan dulu menurut KEDALAMAN posisi (bek → gelandang bertahan → gelandang → penyerang),
// baru dipotong menurut jumlah di formasi, lalu tiap baris diurutkan kiri → kanan menurut kode sisi (L/R).

export interface PitchPlayer {
  position: string;
  /** formationPlace dari ESPN; boleh kosong */
  place?: number;
}

/** Seberapa dekat ke gawang sendiri: kecil = bertahan, besar = menyerang. */
export function depthOf(position: string): number {
  const p = String(position ?? '').toUpperCase().trim();
  if (!p) return 3;
  if (/^G/.test(p)) return 0;
  if (/^DM/.test(p)) return 2; // sebelum aturan bek: "DM" juga diawali D
  if (/^[LR]?WB/.test(p)) return 1.6;
  if (/^(CD|CB|SW|LB|RB|D)/.test(p)) return 1;
  if (/^AM/.test(p)) return 4;
  if (/^(LW|RW|W)/.test(p)) return 4.5;
  if (/^SS/.test(p)) return 4.8;
  if (/^(F|CF|ST|LF|RF)/.test(p)) return 5;
  if (/^[LR]M$/.test(p)) return 3.4; // gelandang sayap sedikit lebih maju dari CM
  return 3; // CM, M, dan kode tak dikenal
}

/**
 * Posisi menyamping dari kode ESPN: -2 = melebar di kiri (LB, LWB, LM, LW), -1 = agak ke kiri (CD-L, CM-L, AM-L),
 * 0 = tengah, 1 = agak ke kanan, 2 = melebar di kanan. Angka kecil = lebih ke kiri tim.
 */
export function lateralOf(position: string): -2 | -1 | 0 | 1 | 2 {
  const p = String(position ?? '').toUpperCase().trim();
  if (/^L[A-Z]/.test(p)) return -2;
  if (/^R[A-Z]/.test(p)) return 2;
  if (/-L$/.test(p)) return -1;
  if (/-R$/.test(p)) return 1;
  return 0;
}

/**
 * Baris-baris pemain mulai dari kiper. `facing`:
 *  - 'up'   : tim menyerang ke atas layar (kiper di bawah) → sisi kiri tim ada di kiri layar
 *  - 'down' : tim menyerang ke bawah layar (kiper di atas) → sisi kiri tim ada di kanan layar
 */
export function layoutRows<T extends PitchPlayer>(starters: T[], formation: string, facing: 'up' | 'down' = 'up'): T[][] {
  if (!starters.length) return [];
  const order = new Map(starters.map((p, i) => [p, p.place || i + 1]));
  const gk = starters.find((p) => depthOf(p.position) === 0) ?? starters[0];
  const rest = starters.filter((p) => p !== gk).sort((a, b) => depthOf(a.position) - depthOf(b.position) || order.get(a)! - order.get(b)!);

  const digits = /^\d(?:-\d)+$/.test(formation) ? formation.split('-').map(Number) : [];
  let lines: T[][];
  if (digits.length && digits.reduce((a, b) => a + b, 0) === rest.length) {
    lines = [];
    let at = 0;
    for (const n of digits) {
      lines.push(rest.slice(at, at + n));
      at += n;
    }
  } else {
    // formasi tak terbaca / jumlah tak cocok: kelompokkan langsung dari kedalaman posisi
    lines = [rest.filter((p) => depthOf(p.position) < 2), rest.filter((p) => depthOf(p.position) >= 2 && depthOf(p.position) < 4), rest.filter((p) => depthOf(p.position) >= 4)];
  }

  const side = (p: T) => (facing === 'up' ? lateralOf(p.position) : -lateralOf(p.position));
  return [[gk], ...lines]
    .filter((row) => row.length)
    .map((row) => {
      if (new Set(row.map(side)).size < 2) return row; // tak ada info sisi: biarkan urutan ESPN
      return [...row].sort((a, b) => side(a) - side(b) || order.get(a)! - order.get(b)!);
    });
}
