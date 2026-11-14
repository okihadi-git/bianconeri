'use client';

// Potongan tampilan yang dipakai bersama oleh semua tab Analisa.
import type { ReactNode } from 'react';
import { useFetch } from '@/components/kp';

/** Pesan di dalam kartu: memuat, gagal, atau kosong. */
export function Empty({ children }: { children: ReactNode }) {
  return <div className="kp-card kp-empty">{children}</div>;
}

/**
 * Ambil data satu tab dan siapkan pesan memuat/gagal yang seragam.
 * Pakai: `const { data: d, fallback } = useTab<Respons>(url, 'Memuat…'); if (!d) return fallback;`
 */
export function useTab<T>(url: string, loading: string, error = 'Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.') {
  const res = useFetch<T>(url);
  const fallback = res.loading ? <Empty>{loading}</Empty> : !res.data || res.error ? <Empty>{error}</Empty> : null;
  return { data: res.data, fallback };
}

/** Kartu satu tab: judul + keterangan singkat di kepala. */
export function Card({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="kp-card an">
      <header className="kp-card-head">
        <h2 className="kp-title">{title}</h2>
        {sub ? <small className="kp-muted">{sub}</small> : null}
      </header>
      {children}
    </section>
  );
}

/** Kotak angka: label kecil, nilai besar, keterangan opsional. `tone` = kotak gelap/hangat. */
export function Tile({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'dark' | 'warm' }) {
  return (
    <div className={`an-tile${tone ? ` ${tone}` : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

/** Logo klub bulat; tanpa logo → lingkaran abu-abu seukuran. */
export function Logo({ src, size = 24 }: { src: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="an-logo" width={size} height={size} loading="lazy" /> : <span className="an-logo none" style={{ width: size, height: size }} />;
}
