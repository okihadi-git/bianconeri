'use client';

import { useFetch } from '@/components/kp';
import type { MusimResponse, SeasonTotals } from '@/lib/musim';
import './musim.css';

const ROWS: { label: string; get: (t: SeasonTotals) => number; higherBetter: boolean }[] = [
  { label: 'Poin', get: (t) => t.points, higherBetter: true },
  { label: 'Menang', get: (t) => t.wins, higherBetter: true },
  { label: 'Gol', get: (t) => t.gf, higherBetter: true },
  { label: 'Kebobolan', get: (t) => t.ga, higherBetter: false },
  { label: 'Clean sheet', get: (t) => t.cleanSheets, higherBetter: true },
  { label: 'Selisih gol', get: (t) => t.gd, higherBetter: true },
];
const sgn = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

function Delta({ d, higherBetter }: { d: number; higherBetter: boolean }) {
  if (d === 0) return <b className="ms-d eq">=</b>;
  const good = higherBetter ? d > 0 : d < 0;
  return <b className={`ms-d ${good ? 'good' : 'bad'}`}>{d > 0 ? `+${d}` : `−${Math.abs(d)}`}</b>;
}

function Curve({ now, prev, nowLabel, prevLabel }: { now: number[]; prev: number[]; nowLabel: string; prevLabel: string }) {
  const W = 520;
  const H = 250;
  const L = 34;
  const R = 12;
  const T = 14;
  const B = 28;
  const n = now.length;
  const yMax = Math.max(3, ...now, ...prev);
  const x = (i: number) => (n === 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / yMax) * (H - T - B);
  const path = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const yTicks = [0, Math.round(yMax / 2), yMax];
  const xTicks = Array.from(new Set([1, ...Array.from({ length: Math.floor(n / 5) }, (_, i) => (i + 1) * 5), n]));
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="ms-svg" role="img" aria-label={`Poin kumulatif per laga, ${nowLabel} dibanding ${prevLabel}`}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="ms-grid" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="ms-axis">{t}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t - 1)} y={H - 8} textAnchor="middle" className="ms-axis">{t}</text>
        ))}
        <path d={path(prev)} className="ms-line prev" />
        <path d={path(now)} className="ms-line now" />
        {now.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={3.5} className="ms-dot">
            <title>{`Laga ${i + 1}: ${v} poin (${nowLabel}) · ${prev[i]} poin (${prevLabel})`}</title>
          </circle>
        ))}
      </svg>
      <p className="ms-legend">
        <i className="now" /> musim ini ({nowLabel}) <i className="prev" /> musim lalu ({prevLabel}) · poin kumulatif per laga
      </p>
    </>
  );
}

/** Statistik → Analitik → 10 Musim ini vs musim lalu (Serie A pada pekan yang sama). */
export default function MusimIniVsLalu() {
  const res = useFetch<MusimResponse>('/api/analitik/musim-ini-vs-lalu');
  const d = res.data;
  const gap = d?.now && d.prev ? d.now.points - d.prev.points : 0;

  return (
    <section className="ms">
      <header className="ms-head">
        <span className="ms-numtag">10</span>
        <h2>MUSIM INI VS MUSIM LALU</h2>
        <small>Serie A pada pekan yang sama</small>
      </header>

      {res.loading ? <div className="ms-empty">Memuat perbandingan musim…</div> : null}
      {!res.loading && (res.error || !d) ? <div className="ms-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && !res.loading ? (
        !d.now || !d.prev ? (
          <div className="ms-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
        ) : (
          <>
            <p className="ms-summary">
              Setelah <b>{d.n} laga</b> Serie A:{' '}
              {gap === 0 ? <span>poin sama dengan musim lalu pada titik yang sama</span> : <span className={gap > 0 ? 'good' : 'bad'}>{gap > 0 ? `unggul ${gap} poin` : `tertinggal ${Math.abs(gap)} poin`}</span>}
              {gap === 0 ? '.' : ' dari musim lalu pada titik yang sama.'}
            </p>

            <div className="ms-cols">
              <div className="ms-table" role="table" aria-label="Perbandingan musim ini dan musim lalu">
                <div className="ms-r ms-th" role="row">
                  <span />
                  <span>MUSIM INI</span>
                  <span />
                  <span>MUSIM LALU</span>
                  <span />
                  <span>SELISIH</span>
                </div>
                {ROWS.map((r) => {
                  const a = r.get(d.now as SeasonTotals);
                  const b = r.get(d.prev as SeasonTotals);
                  const max = Math.max(1, Math.abs(a), Math.abs(b));
                  return (
                    <div key={r.label} className="ms-r" role="row">
                      <span className="ms-lab">{r.label}</span>
                      <div className="ms-bar now"><i style={{ width: `${(Math.max(0, a) / max) * 100}%` }} /></div>
                      <b className="ms-v">{sgn(a)}</b>
                      <div className="ms-bar prev"><i style={{ width: `${(Math.max(0, b) / max) * 100}%` }} /></div>
                      <b className="ms-v">{sgn(b)}</b>
                      <Delta d={a - b} higherBetter={r.higherBetter} />
                    </div>
                  );
                })}
              </div>
              <div className="ms-chart">
                <Curve now={d.curveNow} prev={d.curvePrev} nowLabel={d.nowLabel} prevLabel={d.prevLabel} />
              </div>
            </div>

            <p className="ms-note">
              Dibandingkan pada jumlah laga yang sama ({d.n} laga Serie A, urut tanggal), bukan pada nomor pekan. Kebobolan lebih sedikit dianggap lebih baik. Sumber: ESPN.
              {d.prevSeason ? ` Musim lalu (${d.prevLabel}) berakhir dengan ${d.prevSeason.points} poin dari ${d.prevSeason.games} laga.` : ''}
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
