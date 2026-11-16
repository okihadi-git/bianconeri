// Sub-menu di bawah menu utama "Statistik". Modul biasa (bukan 'use client') supaya bisa dipakai komponen server maupun klien.
export const STAT_TABS = [
  { href: '/statistik', label: 'Statistik', slug: '' },
  { href: '/statistik/pusat-laga', label: 'Pusat Laga', slug: 'pusat-laga' },
  { href: '/statistik/analitik', label: 'Analitik', slug: 'analitik' },
  { href: '/statistik/bedah-taktik', label: 'Bedah Taktik', slug: 'bedah-taktik' },
  { href: '/statistik/analisa', label: 'Analisa', slug: 'analisa' },
] as const;

export const isStatPath = (path: string | null) => Boolean(path) && (path === '/statistik' || path!.startsWith('/statistik/'));
