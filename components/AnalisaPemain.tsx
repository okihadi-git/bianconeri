'use client';

import { useFetch } from '@/components/kp';
import type { PemainResponse } from '@/lib/pemain';
import './pemain.css';

const dec = (n: number) => n.toFixed(2).replace('.', ',');
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${dec(Math.abs(n))}`;
const pillTone = (left: number) => (left <= 2 ? 'hot' : left <= 5 ? 'near' : '');

/** Statistik → Analisa → Pemain. */
export default function AnalisaPemain() {
  const res = useFetch<PemainResponse>('/api/analisa/pemain');
  const d = res.data;
  if (res.loading) return <div className="kp-card kp-empty">Memuat analisa pemain… (pertama kali bisa beberapa detik)</div>;
  if (res.error || !d) return <div className="kp-card kp-empty">Analisa pemain belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div>;
  if (!d.matches) return <div className="kp-card kp-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>;

  return (
    <section className="kp-card pm">
      <header className="kp-card-head">
        <h2 className="kp-title">Analisa pemain</h2>
        <small className="kp-muted">Efisiensi, dampak, duet, dan tonggak karier</small>
      </header>

      <p className="pm-intro">
        Statistik lengkap per pemain dan per kompetisi ada di menu <b>Statistik</b>. Di sini: dampak, duet, dan tonggak karier (semua kompetisi).
      </p>

      <h3 className="pm-h">Dampak pemain: saat jadi starter vs tidak</h3>
      {d.impact.length ? (
        <>
          <div className="pm-wrap">
            <table className="pm-table">
              <thead>
                <tr>
                  <th className="l">PEMAIN</th>
                  <th>POIN/LAGA SAAT START</th>
                  <th>SAAT TIDAK START</th>
                  <th>SELISIH</th>
                  <th>GOL/LAGA (START · TIDAK)</th>
                  <th>KEBOBOLAN/LAGA (START · TIDAK)</th>
                </tr>
              </thead>
              <tbody>
                {d.impact.map((r) => (
                  <tr key={r.id}>
                    <td className="l pm-name">{r.name}</td>
                    <td><b>{dec(r.startPpg)}</b><small>{r.startN} laga</small></td>
                    <td>{dec(r.outPpg)}<small>{r.outN} laga</small></td>
                    <td><span className={`pm-diff${r.diff >= 0.5 ? ' up' : ''}`}>{signed(r.diff)}</span></td>
                    <td>{dec(r.startGf)} · {dec(r.outGf)}</td>
                    <td>{dec(r.startGa)} · {dec(r.outGa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pm-note">Semua kompetisi. Pemain dengan minimal 3 laga starter dan 2 laga tidak start. Bukan hubungan sebab-akibat murni: lawan dan rotasi ikut berpengaruh, dan sampel awal musim masih kecil.</p>
        </>
      ) : (
        <p className="pm-note">Belum ada pemain dengan sampel cukup (minimal 3 laga starter dan 2 laga tidak start).</p>
      )}

      <h3 className="pm-h">Duet terbaik (assist → gol)</h3>
      {d.duets.length ? (
        <ul className="pm-duets">
          {d.duets.map((x) => (
            <li key={`${x.assist}>${x.scorer}`}>
              <span>{x.assist} → {x.scorer}</span>
              <b>{x.goals} <small>gol</small></b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pm-note">Belum ada gol dengan assist yang tercatat di ESPN.</p>
      )}

      <h3 className="pm-h">Tonggak karier di Juventus</h3>
      {d.milestones.length ? (
        <div className="pm-wrap">
          <table className="pm-table pm-ms">
            <thead>
              <tr>
                <th className="l">PEMAIN</th>
                <th>LAGA</th>
                <th>GOL</th>
                <th className="l">TONGGAK LAGA BERIKUTNYA</th>
                <th className="l">TONGGAK GOL BERIKUTNYA</th>
              </tr>
            </thead>
            <tbody>
              {d.milestones.map((m) => (
                <tr key={m.name}>
                  <td className="l pm-name">{m.name}</td>
                  <td><b>{m.apps}</b></td>
                  <td><b>{m.goals}</b></td>
                  <td className="l"><span className={`pm-pill ${pillTone(m.appsLeft)}`}>{m.appsLeft} lagi</span> menuju {m.nextApps} laga</td>
                  <td className="l"><span className={`pm-pill ${pillTone(m.goalsLeft)}`}>{m.goalsLeft} lagi</span> menuju {m.nextGoals} gol</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="pm-note">Belum ada pemain skuad yang cocok dengan daftar Wikipedia.</p>
      )}
      {d.wiki ? (
        <p className="pm-note">
          Semua kompetisi resmi. Angka dasar {d.wiki.asOf ? `per ${d.wiki.asOf}` : 'dari Wikipedia'}, lalu ditambah otomatis dari laga sesudahnya. Hanya pemain dengan 100+ laga untuk Juventus yang ada di daftar sumber.
        </p>
      ) : null}
      {d.wiki ? (
        <p className="pm-note">
          Sumber: <a href={d.wiki.url} target="_blank" rel="noreferrer">Wikipedia: {d.wiki.title}</a> (CC BY-SA 4.0); laga dan assist dari ESPN.
        </p>
      ) : null}
      {d.warnings.length ? <p className="pm-note">{d.warnings.join(' ')}</p> : null}
    </section>
  );
}
