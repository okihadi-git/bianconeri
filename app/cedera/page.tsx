'use client';

import { useEffect, useMemo, useState } from 'react';
import Face from '@/components/Face';
import { fmtClock, useFetch } from '@/components/kp';
import type { InjuredPlayer, InjuryKind, InjuryResponse } from '@/lib/injuries';
import { findPlayer } from '@/lib/names';
import type { NewsEntity, NewsItem, NewsResponse } from '@/lib/news-types';
import { positionId } from '@/lib/playerprofile';
import '../berita/berita.css';

const KIND_LABEL: Record<InjuryKind, string> = { lama: 'Absen lama', segera: 'Segera kembali', diragukan: 'Diragukan', absen: 'Absen' };

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

function InjuryCard({ p, news }: { p: InjuredPlayer; news: NewsItem[] }) {
  return (
    <article className="ij-card">
      <div className="ij-top">
        <Face src={p.photo} name={p.name} size={68} />
        <span className={`ij-badge ij-${p.kind}`}>{KIND_LABEL[p.kind]}</span>
      </div>
      <h3 className="ij-name">{p.name}</h3>
      <div className="ij-pos kp-muted">{[p.jersey && `#${p.jersey}`, positionId(p.position)].filter(Boolean).join(' · ')}</div>
      <dl className="ij-rows">
        <div>
          <dt>Cedera</dt>
          <dd>{p.injury}</dd>
        </div>
        <div>
          <dt>Kembali</dt>
          <dd>{p.returns ?? 'TBC'}</dd>
        </div>
      </dl>
      {news.length > 0 && (
        <ul className="ij-news">
          {news.slice(0, 2).map((n) => (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noopener noreferrer">
                {n.title}
              </a>
              <small className="kp-muted"> · {n.source}</small>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function CederaPage() {
  const inj = useFetch<InjuryResponse>('/api/cedera');
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

  const injured = inj.data?.players ?? [];
  /** berita cedera yang menyebut pemain ini di judulnya (terbaru dulu) */
  const newsFor = (name: string) =>
    items.filter((i) => i.entities.some((e) => e.kind === 'player' && findPlayer(name, [{ name: e.name }]))).sort((a, b) => b.iso.localeCompare(a.iso));

  return (
    <div className="kp" id="cedera">
      <div className="kp-metrics">
        <div className="kp-metric kp-metric-red">
          <div className="kp-metric-label">Pemain absen</div>
          <div className="kp-metric-val">{inj.data ? injured.length : '–'}</div>
          <div className="kp-metric-sub">{inj.loading ? 'Memuat data…' : inj.error ? 'Data FotMob belum bisa dimuat' : 'Semua kompetisi'}</div>
        </div>
        {(['lama', 'diragukan', 'segera'] as const).map((k) => {
          const list = injured.filter((p) => p.kind === k);
          return (
            <div className="kp-metric" key={k}>
              <div className="kp-metric-label">{KIND_LABEL[k]}</div>
              <div className="kp-metric-val">{inj.data ? list.length : '–'}</div>
              <div className="kp-metric-sub">{inj.data ? (list.length ? list.map((p) => p.name).join(', ') : 'Tidak ada') : ' '}</div>
            </div>
          );
        })}
      </div>

      <section className="kp-card ij-wrap">
        <header className="kp-card-head ij-head">
          <h2 className="kp-title">Pemain cedera</h2>
          <p className="ij-sub kp-muted">
            {inj.data
              ? [
                  `${injured.filter((p) => p.kind === 'lama').length} cedera jangka panjang`,
                  `${injured.filter((p) => p.kind === 'diragukan').length} diragukan`,
                  `${injured.filter((p) => p.kind === 'segera').length} segera kembali`,
                  `update ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(inj.data.updatedAt))}`,
                  'berlaku semua kompetisi',
                ].join(' · ')
              : ' '}
          </p>
        </header>
        {inj.loading && <div className="kp-empty">Memeriksa kondisi pemain…</div>}
        {inj.error && <div className="kp-empty">Data cedera dari FotMob belum bisa dimuat; daftar berita di bawah tetap tersedia. Coba muat ulang beberapa saat lagi.</div>}
        {inj.data && !injured.length && <div className="kp-empty">Tidak ada pemain cedera yang tercatat di FotMob saat ini.</div>}
        {injured.length > 0 && (
          <div className="ij-grid">
            {injured.map((p) => (
              <InjuryCard key={p.id} p={p} news={newsFor(p.name)} />
            ))}
          </div>
        )}
        {inj.data && (
          <p className="kp-note ij-foot">
            Status dari FotMob ({inj.data.checked} pemain skuad diperiksa{inj.data.failed ? `, ${inj.data.failed} gagal dimuat` : ''}). Perkiraan kembali adalah estimasi sumber, bukan keputusan klub. “Segera kembali” = perkiraan kembali dalam 21 hari;
            “diragukan” = cedera ringan/benturan; “absen” = tanggal kembali belum diketahui.
          </p>
        )}
      </section>

      {inj.error && players.length > 0 && (
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
