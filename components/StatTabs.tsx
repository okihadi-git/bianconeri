'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { STAT_TABS } from '@/lib/stat-tabs';

/** Sub-menu "Statistik". Memakai gaya yang sama dengan sub-menu Tim (.tim-bar / .tim-tab). */
export default function StatTabs() {
  const pathname = usePathname();
  return (
    <div className="tim-bar" role="navigation" aria-label="Menu statistik">
      <div className="tim-bar-inner">
        {STAT_TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.href} href={t.href} className={`tim-tab${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
