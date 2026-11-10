'use client';

import { useFetch } from '@/components/kp';
import type { PeluangResponse, PeluangTeam } from '@/lib/peluang-server';
import './peluang.css';

const isJuve = (t: PeluangTeam) => t.name.includes('Juventus');

/** 0 → "–", kurang dari 1% → "<1%", hampir pasti → ">99%". */
function pct(p: number): string {
  if (p <= 0) return '–';
  if (p < 0.01) return '<1%';
  if (p >= 0.995) return '>99%';
  return `${Math.round(p * 100)}%`;
}

function Pill({ p, tone }: { p: number; tone: 'gold' | 'pink' | 'gray' }) {
  const w = Math.min(100, Math.max(0, p * 100));
  return (
    <span className={`pj-pill pj-${tone}`} style={{ ['--w' as string]: `${w}%` }}>
      {pct(p)}
    </span>
  );
}

function Logo({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="pj-logo" loading="lazy" /> : null;
}

export default function PeluangJuara() {
  const res = useFetch<PeluangResponse>('/api/peluang?league=ita.1');
  const d = res.data;
  const juve = d?.teams.find(isJuve);

  if (res.loading) return <div className="kp-card kp-empty">Menjalankan simulasi sisa musim…</div>;
  if (res.error || !d || !juve) {
    return <div className="kp-card kp-empty">Simulasi belum bisa dihitung: klasemen atau hasil laga Serie A belum bisa dimuat dari ESPN. Coba muat ulang beberapa saat lagi.</div>;
  }

  const bars = juve.dist.slice(0, 10).map((p, i) => ({ label: String(i + 1), p }));
  const tail = juve.dist.slice(10).reduce((a, b) => a + b, 0);
  if (tail >= 0.01) bars.push({ label: '11+', p: tail });
  const top = Math.max(...bars.map((b) => b.p), 0.01);

  return (
    <section className="kp-card pj">
      <header className="kp-card-head">
        <h2 className="kp-title">Peluang juara &amp; top 4</h2>
        <small className="kp-muted">Simulasi {d.sims.toLocaleString('id-ID')} kali sisa musim Serie A</small>
      </header>

      <div className="pj-tiles">
        <div className="pj-tile pj-hero">
          <small>Peluang juara</small>
          <b>{pct(juve.title)}</b>
          <span>Juventus</span>
        </div>
        <div className="pj-tile">
          <small>Peluang top 4</small>
          <b>{pct(juve.ucl)}</b>
          <span>lolos Liga Champions</span>
        </div>
        <div className="pj-tile">
          <small>Proyeksi poin akhir</small>
          <b>{Math.round(juve.proj)}</b>
          <span>sekarang {juve.points} poin dari {juve.played} laga</span>
        </div>
        <div className="pj-tile">
          <small>Posisi paling mungkin</small>
          <b>#{juve.mostLikely}</b>
          <span>{pct(juve.dist[juve.mostLikely - 1])} dari simulasi</span>
        </div>
      </div>

      <div className="pj-hist" role="img" aria-label="Sebaran posisi akhir Juventus">
        {bars.map((b, i) => (
          <div key={b.label} className="pj-col">
            <span className="pj-val">{b.p > 0 ? pct(b.p) : ''}</span>
            <div className="pj-barwrap">
              <i className={i === 0 ? 'gold' : ''} style={{ height: b.p > 0 ? `${Math.max(2, (b.p / top) * 100)}%` : '2px', opacity: b.p > 0 ? 1 : 0.35 }} />
            </div>
            <span className="pj-pos">{b.label}</span>
          </div>
        ))}
      </div>
      <p className="pj-cap">Sebaran posisi akhir Juventus (posisi 1–10{tail >= 0.01 ? ' dan 11+' : ''})</p>

      <div className="pj-tablewrap">
        <table className="pj-table">
          <thead>
            <tr>
              <th>#</th>
              <th className="l">KLUB</th>
              <th>POIN</th>
              <th>PROYEKSI</th>
              <th>JUARA</th>
              <th>TOP 4</th>
              <th>DEGRADASI</th>
            </tr>
          </thead>
          <tbody>
            {d.teams.map((t) => (
              <tr key={t.id} className={isJuve(t) ? 'me' : ''}>
                <td>{t.position}</td>
                <td className="l"><Logo src={t.logo} /> <span>{t.name}</span></td>
                <td>{t.points}</td>
                <td><b>{Math.round(t.proj)}</b></td>
                <td><Pill p={t.title} tone="gold" /></td>
                <td><Pill p={t.ucl} tone="pink" /></td>
                <td><Pill p={t.rel} tone="gray" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {d.warnings.map((w) => (
        <p key={w} className="pj-warn">{w}</p>
      ))}
      <p className="pj-foot">
        Dihitung dari {d.sims.toLocaleString('id-ID')} simulasi {d.remaining} laga tersisa. Kekuatan serang dan bertahan tiap tim diambil dari gol musim ini ({d.playedMatches} laga sudah dimainkan), ditarik ke rata-rata liga supaya
        tidak berlebihan di awal musim, plus keuntungan main di kandang. Cedera, transfer, dan jadwal Eropa tidak diperhitungkan. Urutan akhir memakai poin, selisih gol, lalu gol, bukan aturan head-to-head Serie A. Hasil
        disimpan sementara sekitar 15 menit. Data: ESPN.
      </p>
    </section>
  );
}
