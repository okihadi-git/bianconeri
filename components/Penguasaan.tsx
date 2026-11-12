'use client';

import { useState } from 'react';
import { useFetch } from '@/components/kp';
import type { Bucket, PossMatch, PossessionResponse } from '@/lib/penguasaan';
import './penguasaan.css';

const dec = (n: number, d = 2) => n.toFixed(d).replace('.', ',');
const dec1 = (n: number) => dec(n, 1);
const ppmText = (n: number | null) => (n == null ? '–' : dec(n));

/* ---------- grafik batang penguasaan bola per laga ---------- */

function PossChart({ matches }: { matches: PossMatch[] }) {
  const n = matches.length;
  const vals = matches.map((m) => m.poss);
  const lo = Math.min(40, Math.floor((Math.min(...vals) - 6) / 10) * 10);
  const hi = Math.max(60, Math.ceil((Math.max(...vals) + 2) / 10) * 10);
  const yOf = (p: number) => ((hi - p) / (hi - lo)) * 100;
  const y50 = yOf(50);
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 10) ticks.push(t);

  return (
    <div className="pb-chart">
      <div className="pb-plot">
        <div className="pb-axis">
          {ticks.map((t) => (
            <span key={t} style={{ top: `${yOf(t)}%` }}>{t}%</span>
          ))}
        </div>
        <div className="pb-area">
          {ticks.map((t) => (
            <i key={t} className={`pb-grid${t === 50 ? ' base' : ''}`} style={{ top: `${yOf(t)}%` }} />
          ))}
          <div className="pb-cols" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {matches.map((m) => {
              const up = m.poss >= 50;
              const y = yOf(m.poss);
              const top = up ? y : y50;
              const h = Math.max(1.2, Math.abs(y - y50));
              return (
                <div key={m.id} className="pb-col" title={`vs ${m.opp} · ${m.poss}% · ${m.gf}-${m.ga}${m.xgFor != null ? ` · xG ${dec(m.xgFor)} : ${dec(m.xgAgainst as number)}` : ''}`}>
                  <b className={up ? 'up' : 'down'} style={{ top: `${top}%`, height: `${h}%` }} />
                </div>
              );
            })}
          </div>
          <svg className="pb-line" viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" aria-hidden="true">
            <polyline points={matches.map((m, i) => `${i + 0.5},${yOf(m.poss)}`).join(' ')} fill="none" vectorEffect="non-scaling-stroke" />
          </svg>
          {matches.map((m, i) => (
            <u key={m.id} className="pb-dot" style={{ left: `${((i + 0.5) / n) * 100}%`, top: `${yOf(m.poss)}%` }} />
          ))}
        </div>
      </div>
      <div className="pb-res" style={{ gridTemplateColumns: `44px repeat(${n}, minmax(0, 1fr))` }}>
        <span />
        {matches.map((m) => (
          <div key={m.id} title={`vs ${m.opp} · ${m.gf}-${m.ga}`}>
            <i className={m.result}>{m.result}</i>
            <small>{m.code}</small>
          </div>
        ))}
      </div>
      <ul className="pb-key">
        <li><i className="up" />di atas 50%</li>
        <li><i className="down" />di bawah 50%</li>
        <li>lingkaran = hasil (M/S/K) · arahkan kursor/ketuk batang untuk detail</li>
      </ul>
    </div>
  );
}

/* ---------- hasil menurut penguasaan: busur poin/laga ---------- */

function Gauge({ b }: { b: Bucket }) {
  const share = Math.max(0, Math.min(1, b.ppm / 3)) * 100;
  return (
    <div className="pb-bucket">
      <h4>{b.label}</h4>
      <small>
        {b.matches} laga · {b.w}M {b.d}S {b.l}K
      </small>
      <div className="pb-gauge">
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
        <dd>{dec1(b.gf)} : {dec1(b.ga)}</dd>
        <dt>xG</dt>
        <dd>{b.xgFor == null ? '–' : `${dec(b.xgFor)} : ${dec(b.xgAgainst as number)}`}</dd>
      </dl>
    </div>
  );
}

/* ---------- sebar: penguasaan vs selisih xG ---------- */

const SC_W = 460;
const SC_H = 300;
const M = { l: 34, r: 18, t: 16, b: 34 };

function Scatter({ matches, trend }: { matches: PossMatch[]; trend: PossessionResponse['trend'] }) {
  const pts = matches.filter((m) => m.xgFor != null && m.xgAgainst != null).map((m) => ({ m, x: m.poss, y: (m.xgFor as number) - (m.xgAgainst as number) }));
  if (pts.length < 2) return <div className="pb-none">Belum cukup laga dengan data xG.</div>;
  const xs = pts.map((p) => p.x);
  const xlo = Math.min(30, Math.floor(Math.min(...xs) / 10) * 10);
  const xhi = Math.max(70, Math.ceil(Math.max(...xs) / 10) * 10);
  const ymax = Math.max(1, Math.ceil(Math.max(...pts.map((p) => Math.abs(p.y))) * 2) / 2);
  const sx = (x: number) => M.l + ((x - xlo) / (xhi - xlo)) * (SC_W - M.l - M.r);
  const sy = (y: number) => M.t + ((ymax - y) / (2 * ymax)) * (SC_H - M.t - M.b);
  const xTicks = [30, 50, 70].filter((t) => t >= xlo && t <= xhi);
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  const clampY = (y: number) => Math.max(-ymax, Math.min(ymax, y));

  return (
    <svg className="pb-scatter" viewBox={`0 0 ${SC_W} ${SC_H}`} role="img" aria-label="Penguasaan bola dibanding selisih xG per laga">
      <line x1={sx(50)} x2={sx(50)} y1={M.t} y2={SC_H - M.b} className="ax" />
      <line x1={M.l} x2={SC_W - M.r} y1={sy(0)} y2={sy(0)} className="ax" />
      <text x={M.l - 4} y={M.t + 4} textAnchor="end" className="lb">xG +</text>
      <text x={M.l - 4} y={SC_H - M.b} textAnchor="end" className="lb">xG −</text>
      {xTicks.map((t) => (
        <text key={t} x={sx(t)} y={SC_H - 12} textAnchor="middle" className="lb">{t}%</text>
      ))}
      {trend ? <line x1={sx(x1)} y1={sy(clampY(trend.intercept + trend.slope * x1))} x2={sx(x2)} y2={sy(clampY(trend.intercept + trend.slope * x2))} className="tr" /> : null}
      {pts.map(({ m, x, y }) => (
        <circle key={m.id} cx={sx(x)} cy={sy(y)} r="6.5" className={`pt ${m.result}`}>
          <title>{`vs ${m.opp} · ${m.poss}% · ${m.gf}-${m.ga} · selisih xG ${y >= 0 ? '+' : '-'}${dec(Math.abs(y))}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function trendText(r: number) {
  if (r >= 0.5) return 'penguasaan bola dan kualitas peluang kuat naik bersama musim ini.';
  if (r >= 0.2) return 'penguasaan bola dan kualitas peluang cenderung naik bersama musim ini.';
  if (r > -0.2) return 'penguasaan bola hampir tidak berhubungan dengan kualitas peluang musim ini.';
  if (r > -0.5) return 'makin banyak menguasai bola, kualitas peluang cenderung turun musim ini.';
  return 'makin banyak menguasai bola, kualitas peluang kuat cenderung turun musim ini.';
}

/** Statistik → Analitik → 06 Penguasaan bola (per laga, hasil menurut penguasaan, hubungan dengan selisih xG). */
export default function Penguasaan() {
  const [comp, setComp] = useState('all');
  const res = useFetch<PossessionResponse>(`/api/analitik/penguasaan?comp=${encodeURIComponent(comp)}`);
  const d = res.data;

  return (
    <section className="pb">
      <header className="pb-head">
        <span className="pb-num">06</span>
        <h2>PENGUASAAN BOLA</h2>
        <small>Possession per laga dan pengaruhnya ke hasil</small>
      </header>

      {d && d.competitions.length > 1 ? (
        <div className="pb-pills" role="tablist" aria-label="Kompetisi">
          {[{ id: 'all', name: 'Semua' }, ...d.competitions].map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={comp === c.id} className={`pb-pill${comp === c.id ? ' on' : ''}`} onClick={() => setComp(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      {res.loading ? <div className="pb-empty">Memuat penguasaan bola… (pertama kali bisa beberapa detik)</div> : null}
      {!res.loading && (res.error || !d) ? <div className="pb-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && !res.loading ? (
        d.matches.length === 0 ? (
          <div className="pb-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
        ) : (
          <>
            <div className="pb-cards">
              <div className="pb-card hero">
                <small>RATA-RATA PENGUASAAN BOLA</small>
                <b>{d.avg}%</b>
                <span>{d.matches.length} laga</span>
              </div>
              <div className="pb-card">
                <small>SAAT MENGUASAI ≥ 50%</small>
                <b>
                  {ppmText(d.atLeast50.ppm)} <em>poin/laga</em>
                </b>
                <span>{d.atLeast50.matches} laga</span>
              </div>
              <div className="pb-card">
                <small>SAAT MENGUASAI &lt; 50%</small>
                <b>
                  {ppmText(d.below50.ppm)} <em>poin/laga</em>
                </b>
                <span>{d.below50.matches} laga</span>
              </div>
              <div className="pb-card">
                <small>TERTINGGI / TERENDAH</small>
                <b>
                  {d.high?.poss}% / {d.low?.poss}%
                </b>
                <span>
                  {d.high?.opp} / {d.low?.opp}
                </span>
              </div>
            </div>

            <h3 className="pb-h">Penguasaan bola per laga</h3>
            <PossChart matches={d.matches} />

            <div className="pb-cols2">
              <div>
                <h3 className="pb-h">Hasil menurut penguasaan bola</h3>
                <div className="pb-buckets">
                  {d.buckets.map((b) => (
                    <Gauge key={b.key} b={b} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="pb-h">Penguasaan bola vs selisih xG</h3>
                <Scatter matches={d.matches} trend={d.trend} />
                {d.trend ? (
                  <p className="pb-trend">
                    Garis kuning = tren. Korelasi r = {dec(d.trend.r)} → {trendText(d.trend.r)}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="pb-note">
              Penguasaan bola dari statistik laga FotMob (Opta); xG per laga dijumlahkan dari xG per tembakan. Hanya laga resmi: laga persahabatan klub tidak dihitung. Poin per laga: menang 3, seri 1, kalah 0.
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
