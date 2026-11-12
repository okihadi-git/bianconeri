'use client';

import { useFetch } from '@/components/kp';
import type { PadatBucket, PadatPoint, PadatResponse } from '@/lib/padat';
import './padat.css';

const fmt = (n: number) => n.toFixed(2).replace('.', ',');
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;
const WORD = { M: 'menang', S: 'seri', K: 'kalah' } as const;
const FILL = { M: '#1f9d55', S: '#9aa0b4', K: '#4f7cff' } as const;

function Card({ b }: { b: PadatBucket }) {
  const tone = b.xgDiff == null ? '' : b.xgDiff > 0 ? ' pos' : b.xgDiff < 0 ? ' neg' : '';
  return (
    <div className="pd-card">
      <strong>{b.label}</strong>
      <small>{b.matches} laga</small>
      <div className="pd-row">
        <b>{b.ppm == null ? '–' : fmt(b.ppm)}</b>
        <span>poin/laga</span>
      </div>
      <div className={`pd-row${tone}`}>
        <b className="pd-xg">{b.xgDiff == null ? '–' : signed(b.xgDiff)}</b>
        <span>selisih xG/laga</span>
      </div>
    </div>
  );
}

function Scatter({ points }: { points: PadatPoint[] }) {
  const W = 520;
  const H = 300;
  const L = 44;
  const R = 16;
  const T = 14;
  const B = 34;
  const maxRest = Math.max(14, ...points.map((p) => p.rest));
  const xMax = Math.ceil(maxRest / 2) * 2;
  const yAbs = Math.max(1, Math.ceil(Math.max(...points.map((p) => Math.abs(p.xgd))) * 2) / 2);
  const x = (v: number) => L + (v / xMax) * (W - L - R);
  const y = (v: number) => T + ((yAbs - v) / (2 * yAbs)) * (H - T - B);
  const ticks = Array.from({ length: Math.floor(xMax / 2) }, (_, i) => (i + 1) * 2);
  // titik dengan jeda dan selisih sama persis digeser sedikit supaya tidak tertumpuk
  const seen = new Map<string, number>();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pd-svg" role="img" aria-label="Hari istirahat dibanding selisih xG tiap laga">
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="pd-zero" />
      <text x={L - 8} y={T + 10} textAnchor="end" className="pd-axis">xG +</text>
      <text x={L - 8} y={H - B} textAnchor="end" className="pd-axis">xG −</text>
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - 12} textAnchor="middle" className="pd-axis">{t} hr</text>
      ))}
      {points.map((p) => {
        const k = `${p.rest}|${p.xgd}`;
        const n = seen.get(k) ?? 0;
        seen.set(k, n + 1);
        return (
          <circle key={p.id} cx={x(p.rest) + n * 5} cy={y(p.xgd)} r={7} fill={FILL[p.result]} stroke="#000" strokeWidth={1.5}>
            <title>{`${p.opp} ${p.score} (${WORD[p.result]}) · jeda ${p.rest} hari · selisih xG ${signed(p.xgd)}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/** Statistik → Analitik → 09 Jadwal padat (hari istirahat vs performa). */
export default function JadwalPadat() {
  const res = useFetch<PadatResponse>('/api/analitik/jadwal-padat');
  const d = res.data;

  return (
    <section className="pd">
      <header className="pd-head">
        <span className="pd-numtag">09</span>
        <h2>JADWAL PADAT</h2>
        <small>Hari istirahat vs performa</small>
      </header>

      {res.loading ? <div className="pd-empty">Memuat jadwal… (pertama kali bisa beberapa detik)</div> : null}
      {!res.loading && (res.error || !d) ? <div className="pd-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && !res.loading ? (
        d.withRest === 0 ? (
          <div className="pd-empty">{d.warnings[0] ?? 'Belum ada laga dengan jeda yang bisa dihitung.'}</div>
        ) : (
          <>
            <div className="pd-cols">
              <div className="pd-cards">
                {d.buckets.map((b) => (
                  <Card key={b.key} b={b} />
                ))}
              </div>
              <div className="pd-chart">
                <h3>Hari istirahat vs selisih xG</h3>
                {d.points.length ? (
                  <>
                    <Scatter points={d.points} />
                    <p className="pd-legend">
                      <i style={{ background: FILL.M }} /> menang <i style={{ background: FILL.S }} /> seri <i style={{ background: FILL.K }} /> kalah · hari istirahat dihitung dari laga resmi sebelumnya
                    </p>
                  </>
                ) : (
                  <div className="pd-empty small">FotMob tidak menyediakan xG untuk laga-laga ini, jadi grafik tidak bisa dibuat.</div>
                )}
              </div>
            </div>
            <p className="pd-note">
              Jeda = selisih waktu kick-off dengan laga resmi sebelumnya di semua kompetisi; laga pertama musim dan jeda di atas 28 hari tidak dihitung. Selisih xG = xG Juventus dikurangi xG lawan (sumber: FotMob), dirata-rata hanya dari laga yang punya xG. Dari {d.total} laga resmi, {d.withRest} punya jeda dan {d.withXg} punya xG.
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
