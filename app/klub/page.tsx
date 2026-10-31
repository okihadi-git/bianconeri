'use client';

import { useFetch } from '@/components/kp';
import type { KlubEra, KlubPhoto, KlubResponse } from '@/lib/types';

const PLACEHOLDER_LABELS = ['Berdiri', 'Kandang', 'Pemilik', 'Di kasta tertinggi'];

/** **teks** -> tebal, tanpa dangerouslySetInnerHTML */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}
    </>
  );
}

function Photo({ photo }: { photo: KlubPhoto }) {
  return (
    <figure className="kl-photo">
      <img src={photo.url} alt={photo.caption} loading="lazy" />
      <figcaption>
        <b>{photo.caption}</b>
        <span className="kl-credit">
          Foto: {photo.credit ?? 'tidak diketahui'}
          {photo.license ? ` · ${photo.license}` : ''} ·{' '}
          {photo.pageUrl ? (
            <a href={photo.pageUrl} target="_blank" rel="noopener noreferrer">
              Wikimedia Commons
            </a>
          ) : (
            'Wikimedia Commons'
          )}
        </span>
      </figcaption>
    </figure>
  );
}

function Era({ era, photo }: { era: KlubEra; photo: KlubPhoto | null }) {
  return (
    <section className="kp-card kl-era">
      <header className="kp-card-head">
        <h2 className="kp-title">{era.title}</h2>
        {era.span && <small className="kp-muted">{era.span}</small>}
      </header>
      <div className={`kl-era-body${photo ? ' has-photo' : ''}`}>
        {photo && <Photo photo={photo} />}
        <div className="kl-text">
          {era.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function KlubPage() {
  const res = useFetch<KlubResponse>('/api/klub?club=juventus');
  const d = res.data;
  const cards = d?.cards ?? PLACEHOLDER_LABELS.map((label) => ({ label, value: null, sub: null }));

  return (
    <div className="kp" id="klub">
      <div className="kp-metrics kl-metrics">
        {cards.map((c, i) => (
          <div key={c.label} className={`kp-metric${i === 0 ? ' kp-metric-red' : ''}`}>
            <div className="kp-metric-label">{c.label}</div>
            <div className={`kp-metric-val${(c.value?.length ?? 0) > 9 ? ' kl-val-long' : ''}`}>{c.value ?? '–'}</div>
            <div className="kp-metric-sub">{c.sub ?? ' '}</div>
          </div>
        ))}
      </div>

      {res.loading && <div className="kp-card kp-empty">Memuat sejarah klub…</div>}
      {res.error && <div className="kp-card kp-empty">Sejarah klub belum bisa dimuat. Coba muat ulang halaman sebentar lagi.</div>}

      {d && (
        <>
          {d.source?.lang === 'en' && (
            <p className="kp-note kl-lang-note">
              Teks narasi di bawah dari Wikipedia bahasa Inggris, karena artikel bahasa Indonesia belum memuat bagian sejarah yang cukup.
            </p>
          )}

          {d.eras.length === 0 && <div className="kp-card kp-empty">Narasi dari Wikipedia belum bisa dimuat saat ini.</div>}
          {d.eras.map((era, i) => (
            <Era key={`${era.title}-${i}`} era={era} photo={i === 0 ? d.photo : null} />
          ))}

          <section className="kp-card kl-era">
            <header className="kp-card-head">
              <h2 className="kp-title">Kronologi singkat</h2>
            </header>
            <ol className="kl-tl">
              {d.timeline.map((t) => (
                <li key={t.year} className="kl-tl-row">
                  <span className="kl-tl-year">{t.year}</span>
                  <span className="kl-tl-text">
                    <Rich text={t.text} />
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <p className="kp-note kl-attrib">
            Narasi:{' '}
            {d.source ? (
              <>
                <a href={d.source.url} target="_blank" rel="noopener noreferrer">
                  {d.source.title}
                </a>{' '}
                di Wikipedia bahasa {d.source.lang === 'id' ? 'Indonesia' : 'Inggris'}, lisensi{' '}
                <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.id" target="_blank" rel="noopener noreferrer">
                  CC BY-SA 4.0
                </a>
                , dipangkas per paragraf. Kartu ringkas: Wikidata (CC0). Kronologi ditulis manual.
              </>
            ) : (
              'belum tersedia. Kartu ringkas dari Wikidata (CC0); kronologi ditulis manual.'
            )}
          </p>
        </>
      )}
    </div>
  );
}
