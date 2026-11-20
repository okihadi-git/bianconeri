'use client';

import { useFetch } from '@/components/shared/kp';

/** Kartu tab Analisa: judul + keterangan singkat, isi di bawahnya. */
export function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="kp-card">
      <header className="an-head">
        <h3>{title}</h3>
        {sub && <small>{sub}</small>}
      </header>
      {children}
    </section>
  );
}

/** Kotak angka: label kecil, nilai besar, keterangan. `dark` = sorotan utama, `warm` = peringatan. */
export function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: 'dark' | 'warm' }) {
  return (
    <div className={`an-tile${tone ? ` ${tone}` : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => <div className="kp-card kp-empty">{children}</div>;

/** Logo klub; kosong/gagal → lingkaran abu-abu. */
export function Logo({ src, size = 22 }: { src?: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="an-logo" width={size} height={size} loading="lazy" /> : <span className="an-logo none" style={{ width: size, height: size }} />;
}

/**
 * Ambil data tab. `fallback` berisi pesan memuat/gagal selama `data` belum ada:
 *   const { data: d, fallback } = useTab<T>(url, 'Memuat…', 'Gagal memuat.');  if (!d) return fallback;
 */
export function useTab<T>(url: string, loading: string, failed: string) {
  const res = useFetch<T>(url);
  const fallback = <Empty>{res.loading ? loading : failed}</Empty>;
  return { data: res.data, fallback };
}
