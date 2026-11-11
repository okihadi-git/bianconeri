import { notFound } from 'next/navigation';
import { STAT_TABS } from '@/lib/stat-tabs';

/** Sub-menu Statistik yang isinya belum dibuat. "pusat-laga" punya halaman sendiri dan lebih diutamakan oleh Next.js. */
export default async function StatPlaceholder({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const t = STAT_TABS.find((x) => x.slug === tab && x.slug !== '');
  if (!t) return notFound();
  return (
    <div className="kp">
      <section className="kp-card">
        <header className="kp-card-head">
          <h2 className="kp-title">{t.label}</h2>
        </header>
        <div className="kp-empty">Bagian ini belum tersedia.</div>
      </section>
    </div>
  );
}
