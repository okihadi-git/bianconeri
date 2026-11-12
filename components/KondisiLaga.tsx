'use client';

import { useFetch } from '@/components/kp';
import { BIG_RIVALS_NOTE, type CondBucket, type KondisiResponse } from '@/lib/kondisilaga';
import './kondisilaga.css';

const dec = (n: number, d = 2) => n.toFixed(d).replace('.', ',');

function Card({ b }: { b: CondBucket }) {
  const share = Math.max(0, Math.min(1, b.ppm / 3)) * 100;
  return (
    <div className="kl-card">
      <h4>{b.label}</h4>
      <small>
        {b.matches} laga · {b.w}M {b.d}S {b.l}K
      </small>
      <div className="kl-gauge">
        <svg viewBox="0 0 200 112" aria-hidden="true">
          <path d="M20 100 A80 80 0 0 1 180 100" pathLength={100} className="track" />
          <path d="M20 100 A80 80 0 0 1 180 100" pathLength={100} className="fill" strokeDasharray={`${share} 100`} />
        </svg>
        <div>
          <b>{dec(b.ppm)}</b>
          <span>poin/laga</span>
        </div>
      </div>
      <dl>
        <dt>Gol</dt>
        <dd>
          {dec(b.gf, 1)} <em>per laga</em>
        </dd>
        <dt>Kebobolan</dt>
        <dd>{dec(b.ga, 1)}</dd>
        <dt>xG</dt>
        <dd>{b.xgFor == null ? '–' : `${dec(b.xgFor)} : ${dec(b.xgAgainst as number)}`}</dd>
      </dl>
    </div>
  );
}

/** Statistik → Analitik → 07 Kondisi laga (kandang/tandang, lawan, jam kick-off WIB, kompetisi). */
export default function KondisiLaga() {
  const res = useFetch<KondisiResponse>(`/api/analitik/kondisi-laga`);
  const d = res.data;

  return (
    <section className="kl">
      <header className="kl-head">
        <span className="kl-num">07</span>
        <h2>KONDISI LAGA</h2>
        <small>Kandang/tandang, lawan, jam kick-off</small>
      </header>

      {res.loading ? <div className="kl-empty">Memuat kondisi laga… (pertama kali bisa beberapa detik)</div> : null}
      {!res.loading && (res.error || !d) ? <div className="kl-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && !res.loading ? (
        d.matches === 0 ? (
          <div className="kl-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
        ) : (
          <>
            <div className="kl-grid">
              {d.buckets.map((b) => (
                <Card key={b.key} b={b} />
              ))}
            </div>
            <p className="kl-note">
              Papan atas = {BIG_RIVALS_NOTE}. Jam kick-off dalam WIB. Gabungan semua kompetisi resmi ({d.matches} laga); laga persahabatan tidak dihitung. Poin per laga: menang 3, seri 1, kalah 0.
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
