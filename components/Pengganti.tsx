'use client';

import { useFetch } from '@/components/kp';
import { BIN_TICKS, type PenggantiResponse, type SuperSub } from '@/lib/pengganti';
import './pengganti.css';

function Contrib({ p }: { p: SuperSub }) {
  return (
    <span className="pg-icons" aria-label={`${p.goals} gol, ${p.assists} assist`}>
      {Array.from({ length: p.goals }, (_, i) => (
        <i key={`g${i}`} className="pg-ball" title="Gol" />
      ))}
      {Array.from({ length: p.assists }, (_, i) => (
        <i key={`a${i}`} className="pg-a" title="Assist">A</i>
      ))}
      {p.assists === 0 ? <em>–</em> : null}
    </span>
  );
}

/** Statistik → Analitik → 04 Pemain pengganti (dampak bangku cadangan). */
export default function Pengganti() {
  const res = useFetch<PenggantiResponse>(`/api/analitik/pengganti`);
  const d = res.data;
  const max = Math.max(1, ...(d?.bins ?? []));
  const coach = d?.coach ? d.coach.trim().split(/\s+/).slice(-1)[0] : '';

  return (
    <section className="pg">
      <header className="pg-head">
        <span className="pg-num">04</span>
        <h2>PEMAIN PENGGANTI</h2>
        <small>Dampak dari bangku cadangan</small>
      </header>

      {res.loading ? <div className="pg-empty">Memuat data pergantian… (pertama kali bisa beberapa detik)</div> : null}
      {!res.loading && (res.error || !d) ? <div className="pg-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && !res.loading ? (
        d.totals.subs === 0 ? (
          <div className="pg-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
        ) : (
          <>
            <div className="pg-cards">
              <div className="pg-card hero">
                <small>GOL + ASSIST PENGGANTI</small>
                <b>{d.totals.contributions}</b>
                <span>dari {d.totals.subs} pergantian</span>
              </div>
              <div className="pg-card">
                <small>PERGANTIAN PERTAMA</small>
                <b>{d.avgFirst != null ? `${d.avgFirst}'` : '–'}</b>
                <span>rata-rata menit</span>
              </div>
              <div className="pg-card">
                <small>POIN BERTAMBAH</small>
                <b>{d.gained}</b>
                <span>setelah pergantian pertama</span>
              </div>
              <div className="pg-card">
                <small>POIN HILANG</small>
                <b>{d.lost}</b>
                <span>setelah pergantian pertama</span>
              </div>
            </div>

            <div className="pg-cols">
              <div>
                <h3>{coach ? `Kapan ${coach} melakukan pergantian` : 'Kapan pergantian dilakukan'}</h3>
                <div className="pg-chart" role="img" aria-label="Jumlah pergantian per 10 menit">
                  {d.bins.map((n, i) => (
                    <div key={i} className="pg-col" title={`${BIN_TICKS[i]}: ${n} pergantian`}>
                      <div className="pg-barwrap">
                        <i style={{ height: n ? `${Math.max(6, (n / max) * 100)}%` : '3px' }} className={n ? '' : 'zero'} />
                      </div>
                      <code>{BIN_TICKS[i]}</code>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3>Super-sub</h3>
                <ul className="pg-list">
                  {d.top.map((p) => (
                    <li key={p.id}>
                      <b>{p.name}</b>
                      <Contrib p={p} />
                      <span className="pg-apps">{p.apps}× masuk</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="pg-note">
              &quot;Poin bertambah/hilang&quot; = selisih poin akhir dibanding skor saat pergantian pertama dilakukan. Sumber: FotMob (susunan pemain dan kejadian), {d.totals.matches} laga. Gol dan assist dihitung hanya bila terjadi setelah pemain masuk.
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
