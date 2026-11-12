'use client';

import Face from '@/components/Face';
import { useFetch } from '@/components/kp';
import type { KreatorResponse } from '@/lib/kreator';
import './kreator.css';

const dec = (n: number) => n.toFixed(2).replace('.', ',');
const eurM = (v: number) => `€${(v / 1e6).toFixed(1).replace('.', ',')} jt`;
const eurK = (v: number) => `€${Math.round(v / 1000).toLocaleString('id-ID')} rb`;
const WAY_COLORS = ['#ffc72c', '#f6a3c4', '#4f7cff', '#2fbf71', '#e8e8e8', '#ff8a3d', '#9b8cff'];

/** Statistik → Analitik → 01 Peluang diciptakan (10 kreator teratas Juventus). */
export default function Kreator() {
  const res = useFetch<KreatorResponse>(`/api/analitik/kreator`);
  const d = res.data;

  return (
    <section className="kr">
      <header className="kr-head">
        <span className="kr-num">01</span>
        <h2>PELUANG DICIPTAKAN</h2>
        <small>Siapa kreator utama Juventus</small>
      </header>

      {res.loading ? <div className="kr-empty">Memuat peluang diciptakan… (pertama kali bisa beberapa detik)</div> : null}
      {!res.loading && (res.error || !d) ? <div className="kr-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && !res.loading ? (
        d.top.length === 0 ? (
          <div className="kr-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
        ) : (
          <>
            <div className="kr-cards">
              <div className="kr-card hero">
                <small>KREATOR UTAMA (xA)</small>
                <b>{d.cards.xa?.name.split(' ').slice(-1)[0] ?? '–'}</b>
                <span>{d.cards.xa ? `${dec(d.cards.xa.xa)} xA · ${d.cards.xa.chances} peluang` : 'xA tidak tersedia'}</span>
              </div>
              <div className="kr-card">
                <small>PELUANG TERBANYAK</small>
                <b>{d.cards.chances?.name.split(' ').slice(-1)[0] ?? '–'}</b>
                <span>{d.cards.chances ? `${d.cards.chances.chances} umpan kunci` : '–'}</span>
              </div>
              <div className="kr-card">
                <small>PELUANG EMAS DICIPTAKAN</small>
                <b>{d.cards.big?.name.split(' ').slice(-1)[0] ?? '–'}</b>
                <span>{d.cards.big ? `${d.cards.big.big} peluang besar` : 'tidak dilaporkan'}</span>
              </div>
              <div className="kr-card">
                <small>TOTAL UMPAN KUNCI</small>
                <b>{d.cards.total.chances}</b>
                <span>
                  semua pemain · {d.cards.total.matches} laga
                </span>
              </div>
            </div>

            <div className="kr-grid">
              <div>
                <h3>Peringkat kreator</h3>
                <ol className="kr-list">
                  {d.top.map((p, i) => {
                    const max = d.rankedBy === 'xa' ? d.top[0].xa : d.top[0].chances;
                    const v = d.rankedBy === 'xa' ? p.xa : p.chances;
                    return (
                      <li key={p.id} className="kr-row">
                        <span className="kr-rank">{i + 1}</span>
                        <Face src={p.photo} name={p.name} size={40} />
                        <div className="kr-mid">
                          <b>{p.name}</b>
                          <div className="kr-bar">
                            <i style={{ width: `${max ? Math.max(3, (v / max) * 100) : 0}%` }} />
                          </div>
                          {p.salary ? (
                            <small>
                              Gaji {eurM(p.salary)}/thn{p.chances ? ` · ≈ ${eurK(p.salary / p.chances)} per peluang` : ''}
                            </small>
                          ) : null}
                        </div>
                        <div className="kr-nums">
                          <b>{p.chances}</b> <em>peluang</em>
                          <span>
                            {dec(p.xa)} <em>xA</em> · {p.assists} <em>assist</em>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div>
                <h3>Situasi tembakan Juventus</h3>
                {d.ways.length ? (
                  <div className="kr-donutwrap">
                    <div
                      className="kr-donut"
                      style={{
                        background: `conic-gradient(${d.ways
                          .map((w, i, a) => {
                            const from = a.slice(0, i).reduce((s, x) => s + x.count, 0) / d.waysTotal;
                            const to = from + w.count / d.waysTotal;
                            return `${WAY_COLORS[i % WAY_COLORS.length]} ${from * 100}% ${to * 100}%`;
                          })
                          .join(',')})`,
                      }}
                    >
                      <div>
                        <b>{d.waysTotal}</b>
                        <span>tembakan</span>
                      </div>
                    </div>
                    <ul className="kr-legend">
                      {d.ways.map((w, i) => (
                        <li key={w.key}>
                          <i style={{ background: WAY_COLORS[i % WAY_COLORS.length] }} />
                          {w.label}
                          <b>{w.pct}%</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="kr-empty small">Data tembakan tidak tersedia.</div>
                )}
              </div>
            </div>

            <p className="kr-note">
              Sumber: FotMob (umpan kunci, xA, peta tembakan){d.top.some((p) => p.salary) ? ' dan database gaji' : ''}. Peringkat memakai {d.rankedBy === 'xa' ? 'xA' : 'jumlah umpan kunci'}; kiper tidak dihitung.
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
