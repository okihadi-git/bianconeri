'use client';

import { useMemo } from 'react';
import { useFetch } from '@/components/kp';
import { computeJalur, pickMode, type HistorySeason, type Tone } from '@/lib/jalur';
import type { Team } from '@/lib/types';
import './jalur.css';

const num = (n: number) => String(n);
const dec = (n: number) => n.toFixed(2).replace('.', ',');
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '–');

function Logo({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="jl-logo" loading="lazy" /> : null;
}

const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

export default function JalurKeTrofi({ standings, loading, error }: { standings: Team[]; loading: boolean; error: boolean | string | null | undefined }) {
  const hist = useFetch<{ history: HistorySeason[] }>('/api/jalur?league=ita.1');
  const mode = pickMode(standings);
  const j = useMemo(() => computeJalur(standings, hist.data?.history ?? [], mode), [standings, hist.data, mode]);

  if (loading) return <div className="kp-card kp-empty">Memuat klasemen…</div>;
  if (error || !j) {
    return <div className="kp-card kp-empty">Data klasemen Serie A belum cukup untuk menghitung jalur. Bagian ini muncul setelah Juventus memainkan laga pertamanya.</div>;
  }

  const ticks = Array.from({ length: j.axisMax / 20 + 1 }, (_, i) => i * 20);
  const missingHistory = !hist.loading && !j.hasHistory;

  return (
    <section className="kp-card jl">
      <header className="jl-head">
        <h2>{j.title}</h2>
        <span>{j.summary}</span>
      </header>

      <div className="jl-cards">
        {j.cards.map((c) => (
          <div key={c.label} className="jl-stat">
            <small>{c.label}</small>
            <b>{c.value}</b>
            <span>{c.sub}</span>
          </div>
        ))}
      </div>

      <div className="jl-body">
        <article className="jl-story">
          <span className={`jl-state jl-${j.state.tone}`}>{j.state.text}</span>
          <small className="jl-kicker">CERITANYA SEJAUH INI</small>
          {j.story.map((p, i) => (
            <p key={i}>
              {p.map((s, k) => (s.b ? <b key={k}>{s.t}</b> : <span key={k}>{s.t}</span>))}
            </p>
          ))}
        </article>

        <h3 className="jl-h">LINTASAN POIN</h3>
        <div className="jl-chart">
          <div className="jl-grid">
            <div className="jl-labels">
              {j.bars.map((b) => (
                <div key={b.name} className={b.isJuve ? 'me' : ''}>
                  {b.name}
                </div>
              ))}
            </div>
            <div className="jl-area">
              {j.markers.map((m) => (
                <div key={m.points} className={`jl-mark jl-mark-${m.tone}`} style={{ left: pct(m.points, j.axisMax) }}>
                  <span>{m.label}</span>
                </div>
              ))}
              {j.bars.map((b) => (
                <div key={b.name} className="jl-track">
                  <i className="jl-max" style={{ width: pct(b.max, j.axisMax) }} />
                  <i className="jl-proj" style={{ left: pct(b.points, j.axisMax), width: pct(Math.max(0, b.proj - b.points), j.axisMax) }} />
                  <i className={`jl-now${b.isJuve ? ' me' : ''}`} style={{ width: pct(b.points, j.axisMax) }} />
                  <span className="jl-projlab" style={{ left: pct(b.proj, j.axisMax) }}>{b.proj}</span>
                </div>
              ))}
              <div className="jl-axis">
                {ticks.map((t) => (
                  <span key={t} style={{ left: pct(t, j.axisMax) }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="jl-legend">
            <span><i className="now" /> Poin sekarang</span>
            <span><i className="proj" /> Proyeksi jika ritme bertahan</span>
            <span><i className="max" /> Maksimal jika menang semua</span>
            <span><i className="line" /> Garis target</span>
          </div>
        </div>

        <h3 className="jl-h">{j.targets.length === 3 ? 'TIGA TARGET YANG PERLU DIKEJAR' : 'TARGET YANG PERLU DIKEJAR'}</h3>
        <div className="jl-targets">
          {j.targets.map((t) => (
            <div key={t.key} className={`jl-target jl-t-${t.key}`}>
              <div className="jl-thead">
                <b>{t.label.toUpperCase()}</b>
                <span>{t.points} poin</span>
              </div>
              <div className="jl-need">
                <b>{t.need}</b> poin lagi
              </div>
              <div className="jl-prog"><i style={{ width: `${Math.round(t.progress * 100)}%` }} /></div>
              <p className="jl-meta">
                ≈ {t.wins} menang dari {j.cards[3].value} laga{t.perGame != null ? ` · butuh ${dec(t.perGame)}/laga` : ''}
              </p>
              <span className={`jl-pill jl-${t.status.tone}`}>{t.status.text}</span>
              <p className="jl-note">{t.note}</p>
            </div>
          ))}
        </div>
        {missingHistory && <p className="jl-warn">Data musim-musim lalu belum bisa dimuat dari ESPN, jadi target historis (terendah dan rata-rata) tidak ditampilkan.</p>}

        <h3 className="jl-h">SIAPA SAJA YANG BERSAING</h3>
        <div className="jl-tablewrap">
          <table className="jl-table">
            <thead>
              <tr>
                <th>#</th>
                <th className="l">KLUB</th>
                <th>POIN</th>
                <th>VS JUVE</th>
                <th>PROYEKSI</th>
                <th>MAKS</th>
                <th className="l">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {j.rows.map((r) => (
                <tr key={r.name} className={r.isJuve ? 'me' : ''}>
                  <td>{r.pos}</td>
                  <td className="l"><Logo src={r.logo} /> <b>{r.name}</b></td>
                  <td>{num(r.points)}</td>
                  <td>{r.isJuve ? '–' : signed(r.diff)}</td>
                  <td>{r.proj}</td>
                  <td>{r.max}</td>
                  <td className="l"><span className={`jl-pill jl-${r.status.tone as Tone}`}>{r.status.text}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="jl-foot">{j.rowsNote} Proyeksi = poin sekarang + rata-rata poin per laga × sisa laga. Tampilan berganti otomatis ke “Jalan ke trofi” bila Juventus ikut berebut gelar. Data klasemen dan riwayat musim: ESPN.</p>
      </div>
    </section>
  );
}
