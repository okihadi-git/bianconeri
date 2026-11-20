// Pencocokan nama pemain untuk tab Analisa (dipakai Kiper). Memakai pencocokan ketat yang sama dengan gaji dan akademi.
import { normName, sameNameStrict } from '../core/names';

/** Nama dinormalkan: huruf kecil, tanpa aksen/tanda baca, kata dipisah satu spasi. */
export const norm = (s: string) => normName(s).join(' ');

/** Nama sama persis, atau semua kata nama yang lebih pendek ada di nama yang lebih panjang ("Perin" ↔ "Mattia Perin"). */
export const sameName = (a: string, b: string) => sameNameStrict(a, b);
