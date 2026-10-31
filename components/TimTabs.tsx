'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFetch } from '@/components/kp';
import type { NewsResponse } from '@/lib/news-types';

/** Sub-menu di bawah menu utama "Tim". Urutan = urutan tampil. */
export const TIM_TABS = [
  { href: '/skuad', label: 'Skuad' },
  { href: '/kontrak', label: 'Kontrak' },
  { href: '/pelatih', label: 'Pelatih' },
  { href: '/cedera', label: 'Cedera' },
  { href: '/timnas', label: 'Timnas' },
  { href: '/akademi', label: 'Akademi' },
  { href: '/women', label: 'Women' },
] as const;

export const isTimPath = (path: string | null) =>
  Boolean(path) && TIM_TABS.some((t) => path === t.href || path!.startsWith(`${t.href}/`));

/**
 * Lencana di tab Cedera = jumlah pemain berbeda yang disebut di judul berita berkategori cedera
 * (7 hari terakhir). Ini hitungan otomatis dari berita, bukan data medis resmi klub.
 */
function useInjuredCount() {
  const res = useFetch<NewsResponse>('/api/berita');
  const names = new Set<string>();
  for (const item of res.data?.items ?? []) {
    if (item.category !== 'cedera') continue;
    for (const e of item.entities) if (e.kind === 'player') names.add(e.name);
  }
  return names.size;
}

export default function TimTabs() {
  const pathname = usePathname();
  const injured = useInjuredCount();

  return (
    <div className="tim-bar" role="navigation" aria-label="Menu tim">
      <div className="tim-bar-inner">
        {TIM_TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.href} href={t.href} className={`tim-tab${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
              {t.label}
              {t.href === '/cedera' && injured > 0 && (
                <span className="tim-badge" title="Pemain yang disebut di kabar cedera 7 hari terakhir">
                  {injured}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
