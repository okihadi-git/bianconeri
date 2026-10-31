'use client';

import { useEffect, useMemo, useState } from 'react';
import { fmtClock, useFetch } from '@/components/kp';
import type { NewsCategory, NewsEntity, NewsItem, NewsReliability, NewsResponse } from '@/lib/news-types';
import './berita.css';

type CatFilter = 'semua' | NewsCategory;
type RelFilter = 'semua' | 'penting' | NewsReliability;

const CATS: { key: CatFilter; label: string }[] = [
  { key: 'semua', label: 'Semua' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'cedera', label: 'Cedera' },
  { key: 'kontrak', label: 'Kontrak' },
  { key: 'tim', label: 'Tim & laga' },
];
const CAT_LABEL: Record<NewsCategory, string> = { transfer: 'Transfer', cedera: 'Cedera', kontrak: 'Kontrak', tim: 'Tim & laga' };
const CAT_ICON: Record<NewsCategory, string> = { transfer: '⇄', cedera: '✚', kontrak: '✎', tim: '◎' };
const REL_LABEL: Record<NewsReliability, string> = { resmi: 'Resmi', kuat: 'Laporan kuat', rumor: 'Rumor' };

const isImportant = (i: NewsItem) => i.reliability === 'resmi' || i.reliability === 'kuat';

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
      <span className={`bn-icon bn-icon-${item.category}`} aria-hidden="true">
        {CAT_ICON[item.category]}
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

export default function BeritaPage() {
  const res = useFetch<NewsResponse>('/api/berita');
  const [cat, setCat] = useState<CatFilter>('semua');
  const [rel, setRel] = useState<RelFilter>('semua');
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), [res.data]);

  const items = res.data?.items ?? [];
  const byCat = useMemo(() => (cat === 'semua' ? items : items.filter((i) => i.category === cat)), [items, cat]);
  const counts = useMemo(
    () => ({
      penting: byCat.filter(isImportant).length,
      resmi: byCat.filter((i) => i.reliability === 'resmi').length,
      kuat: byCat.filter((i) => i.reliability === 'kuat').length,
      rumor: byCat.filter((i) => i.reliability === 'rumor').length,
      semua: byCat.length,
    }),
    [byCat],
  );
  const shown = useMemo(() => {
    if (rel === 'semua') return byCat;
    if (rel === 'penting') return byCat.filter(isImportant);
    return byCat.filter((i) => i.reliability === rel);
  }, [byCat, rel]);

  const RELS: { key: RelFilter; label: string }[] = [
    { key: 'penting', label: 'Penting' },
    { key: 'resmi', label: 'Resmi' },
    { key: 'kuat', label: 'Kuat' },
    { key: 'rumor', label: 'Rumor' },
    { key: 'semua', label: 'Semua' },
  ];

  return (
    <div className="kp" id="berita">
      <section className="kp-card">
        <header className="kp-card-head">
          <h2 className="kp-title">Berita terkini</h2>
          <small className="kp-muted">
            {res.data ? `Otomatis · diperbarui ${fmtClock(new Date(res.data.updatedAt))} WIB` : 'Otomatis'}
          </small>
        </header>

        <div className="bn-filters">
          <div className="sq-chips">
            {CATS.map((c) => (
              <button key={c.key} className={`sq-chip${cat === c.key ? ' active' : ''}`} onClick={() => setCat(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="sq-chips">
            {RELS.map((r) => (
              <button key={r.key} className={`sq-chip bn-rel bn-rel-${r.key}${rel === r.key ? ' active' : ''}`} onClick={() => setRel(r.key)}>
                {r.label} <small>{counts[r.key]}</small>
              </button>
            ))}
          </div>
        </div>

        {res.loading && <div className="kp-empty">Memuat berita…</div>}
        {res.error && <div className="kp-empty">Berita belum bisa dimuat. Coba muat ulang halaman sebentar lagi.</div>}
        {res.data && !shown.length && <div className="kp-empty">Belum ada berita untuk filter ini.</div>}

        <div className="bn-grid">
          {shown.map((i) => (
            <article key={i.id} className="bn-item">
              <Avatar item={i} />
              <div className="bn-body">
                <div className="bn-meta">
                  <span className={`bn-tag bn-tag-${i.category}`}>{CAT_LABEL[i.category]}</span>
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
          Berita dikumpulkan otomatis dari Google News (judul, sumber, dan tautan saja; isi artikel ada di situs aslinya) dan diperbarui sekitar tiap 20 menit.
          Kategori dan label <b>Resmi / Laporan kuat / Rumor</b> adalah perkiraan otomatis dari kata kunci judul dan daftar sumber, bukan verifikasi fakta;
          rumor transfer bisa berubah kapan saja. Judul tampil dalam bahasa aslinya. Foto pemain dari FotMob, logo klub dari ESPN; pemain tanpa foto
          ditampilkan dengan inisial.
        </p>
      </section>
    </div>
  );
}
