'use client';

import { useState } from 'react';
import { useFetch } from '@/components/kp';
import { KINDS, type Counts, type SetPiecesResponse } from '@/lib/bolamati';
import './bolamati.css';

const dec = (n: number) => n.toFixed(2).replace('.', ',');
const pct = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');

function Stack({ title, counts }: { title: string; counts: Counts }) {
  const total = KINDS.reduce((n, k) => n + counts[k.key], 0);
  return (
    <div className="bm-block">
      <h3>{title}</h3>
      {total === 0 ? (
        <div className="bm-none">Belum ada gol.</div>
      ) : (
        <div className="bm-stack" role="img" aria-label={KINDS.filter((k) => counts[k.key]).map((k) => `${k.label} ${counts[k.key]}`).join(', ')}>
          {KINDS.filter((k) => counts[k.key] > 0).map((k) => (
            <div key={k.key} className={`k-${k.key}`} style={{ flex: counts[k.key], background: k.color }} title={`${k.label}: ${counts[k.key]}`}>
              {counts[k.key]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Statistik → Analitik → 05 Bola mati (menyerang & bertahan). */
export default function BolaMati() {
  const [comp, setComp] = useState('all');
  const res = useFetch<SetPiecesResponse>(`/api/analitik/bola-mati?comp=${encodeURIComponent(comp)}`);
  const d = res.data;
  const t = d?.totals;

  return (
    <section className="bm">
      <header className="bm-head">
        <span className="bm-num">05</span>
        <h2>BOLA MATI</h2>
        <small>Menyerang &amp; bertahan</small>
      </header>

      {d && d.competitions.length > 1 ? (
        <div className="bm-pills" role="tablist" aria-label="Kompetisi">
          {[{ id: 'all', name: 'Semua' }, ...d.competitions].map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={comp === c.id} className={`bm-pill${comp === c.id ? ' on' : ''}`} onClick={() => setComp(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      {res.loading ? <div className="bm-empty">Memuat data bola mati… (pertama kali bisa beberapa detik)</div> : null}
      {!res.loading && (res.error || !d) ? <div className="bm-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && t && !res.loading ? (
        t.matches === 0 ? (
          <div className="bm-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
        ) : (
          <>
            <div className="bm-cards">
              <div className="bm-card hero">
                <small>GOL BOLA MATI</small>
                <b>{t.scoredSp}</b>
                <span>{pct(t.scoredSp, t.scored)} dari {t.scored} gol</span>
              </div>
              <div className="bm-card">
                <small>KEBOBOLAN BOLA MATI</small>
                <b>{t.concededSp}</b>
                <span>{pct(t.concededSp, t.conceded)} dari {t.conceded} kebobolan</span>
              </div>
              <div className="bm-card">
                <small>PENALTI DIDAPAT / DIBERIKAN</small>
                <b>{t.penFor} / {t.penAgainst}</b>
                <span>musim ini</span>
              </div>
              <div className="bm-card">
                <small>XG BOLA MATI</small>
                <b>{d.hasXg ? `${dec(t.xgFor)} : ${dec(t.xgAgainst)}` : '–'}</b>
                <span>{t.shotsFor} vs {t.shotsAgainst} tembakan</span>
              </div>
            </div>

            <Stack title="Jenis gol dicetak" counts={d.scored} />
            <Stack title="Jenis gol kebobolan" counts={d.conceded} />

            <ul className="bm-legend">
              {KINDS.map((k) => (
                <li key={k.key}>
                  <i style={{ background: k.color }} />
                  {k.label}
                </li>
              ))}
            </ul>

            <p className="bm-note">
              Sumber: FotMob (peta tembakan kedua tim), {t.matches} laga. Bola mati = sepak pojok, tendangan bebas langsung, situasi bola mati lain (termasuk lemparan ke dalam), dan penalti. Penalti didapat/diberikan menghitung semua tendangan penalti, termasuk yang gagal; xG bola mati ikut menghitungnya.
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
