'use client';

import { useEffect, useMemo, useState } from 'react';
import { fmtClock, useFetch } from '@/components/kp';
import type { NewsEntity, NewsItem, NewsResponse } from '@/lib/news-types';
import '../berita/berita.css';

const REL_LABEL = { resmi: 'Resmi', kuat: 'Laporan kuat', rumor: 'Rumor' } as const;

/** "3 jam lalu" / "28 Okt" */
function ago(iso: string, now: number) {
  const t = new Date(iso).getTime();
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 60) return `${Math.max(1, min)} menit lalu`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} jam lalu`;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(t)).replace('.', '');
}

function EntityAvatar({ e }: { e: NewsEntity }) {
  const [broken, setBroken] = useState(false);
  if (e.image && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`bn-av bn-av-${e.kind}`} src={e.image} alt="" loading="lazy" onError={() => setBroken(true)} title={e.name} />;
  }
  return (
    <span className="bn-av bn-av-initials" title={e.name}>
      {e.initials}
    </span>
  );
}

function Avatar({ item }: { item: NewsItem }) {
  if (!item.entities.length) {
    return (
      <span className="bn-icon bn-icon-cedera" aria-hidden="true">
        ✚
      </span>
    );
  }
  return (
    <span className={`bn-stack${item.entities.length > 1 ? ' two' : ''}`}>
      {item.entities.map((e) => (
        <EntityAvatar key={`${e.kind}-${e.name}`} e={e} />
      ))}
    </span>
  );
}

export default function CederaPage() {
  const res = useFetch<NewsResponse>('/api/berita');
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), [res.data]);

  const items = useMemo(() => (res.data?.items ?? []).filter((i) => i.category === 'cedera'), [res.data]);

  // pemain yang disebut di judul, dengan jumlah beritanya
  const players = useMemo(() => {
    const map = new Map<string, { e: NewsEntity; count: number }>();
    for (const i of items) {
      for (const e of i.entities) {
        if (e.kind !== 'player') continue;
        const cur = map.get(e.name);
        map.set(e.name, { e: cur?.e ?? e, count: (cur?.count ?? 0) + 1 });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.e.name.localeCompare(b.e.name));
  }, [items]);

  const strong = items.filter((i) => i.reliability === 'resmi' || i.reliability === 'kuat').length;

  return (
    <div className="kp" id="cedera">
      <div className="kp-metrics">
        <div className="kp-metric kp-metric-red">
          <div className="kp-metric-label">Pemain disebut</div>
          <div className="kp-metric-val">{res.data ? players.length : '–'}</div>
          <div className="kp-metric-sub">{res.loading ? 'Memuat data…' : 'Di judul berita cedera 7 hari terakhir'}</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Berita cedera</div>
          <div className="kp-metric-val">{res.data ? items.length : '–'}</div>
          <div className="kp-metric-sub">Termasuk kabar pemulihan</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Resmi / laporan kuat</div>
          <div className="kp-metric-val">{res.data ? strong : '–'}</div>
          <div className="kp-metric-sub">Dari {items.length} berita cedera</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Pembaruan</div>
          <div className="kp-metric-val sq-coach">{res.data ? `${fmtClock(new Date(res.data.updatedAt))} WIB` : '–'}</div>
          <div className="kp-metric-sub">Otomatis tiap ±20 menit</div>
        </div>
      </div>

      {players.length > 0 && (
        <section className="kp-card cd-players-card">
          <header className="kp-card-head">
            <h2 className="kp-title">Pemain yang disebut</h2>
            <small className="kp-muted">Dari judul berita</small>
          </header>
          <div className="cd-players">
            {players.map(({ e, count }) => (
              <span className="cd-player" key={e.name}>
                <EntityAvatar e={e} />
                <b>{e.name}</b>
                <small>{count} berita</small>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="kp-card">
        <header className="kp-card-head">
          <h2 className="kp-title">Kabar cedera terbaru</h2>
          <small className="kp-muted">7 hari terakhir</small>
        </header>

        {res.loading && <div className="kp-empty">Memuat kabar cedera…</div>}
        {res.error && <div className="kp-empty">Kabar cedera belum bisa dimuat. Coba muat ulang halaman sebentar lagi.</div>}
        {res.data && !items.length && <div className="kp-empty">Tidak ada kabar cedera dalam 7 hari terakhir.</div>}

        <div className="bn-grid">
          {items.map((i) => (
            <article key={i.id} className="bn-item">
              <Avatar item={i} />
              <div className="bn-body">
                <div className="bn-meta">
                  <span className="bn-tag bn-tag-cedera">Cedera</span>
                  {i.reliability && <span className={`bn-badge bn-badge-${i.reliability}`}>{REL_LABEL[i.reliability]}</span>}
                  <span className="kp-muted">{now ? ago(i.iso, now) : ''}</span>
                </div>
                <a className="bn-title" href={i.url} target="_blank" rel="noopener noreferrer">
                  {i.title}
                </a>
                <div className="bn-source kp-muted">{i.source}</div>
              </div>
            </article>
          ))}
        </div>

        <p className="kp-note bn-foot">
          Halaman ini <b>bukan buletin medis resmi</b>. Daftar disusun otomatis dari judul berita Google News yang mengandung kata kunci cedera atau pemulihan, sehingga status, diagnosis, dan
          perkiraan waktu kembali tidak bisa dipastikan di sini. Untuk kabar resmi, lihat{' '}
          <a href="https://www.juventus.com" target="_blank" rel="noopener noreferrer" className="pl-link-inline">
            situs resmi Juventus
          </a>
          . Foto pemain dari FotMob; pemain tanpa foto ditampilkan dengan inisial.
        </p>
      </section>
    </div>
  );
}
