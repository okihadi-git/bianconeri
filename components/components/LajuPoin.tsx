'use client';

import { useMemo, useState, type PointerEvent } from 'react';
import { useFetch } from '@/components/kp';
import { pointsAt, summarize, type Benchmark, type LajuTeam } from '@/lib/laju';
import type { LajuResponse } from '@/lib/laju-server';
import './laju.css';

const isJuve = (t: LajuTeam) => t.name.includes('Juventus');
const dec = (n: number) => n.toFixed(2).replace('.', ',');
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

const W = 1000;
const H = 440;
const L = 48;
const R = 46;
const T = 14;
const B = 34;

const COLORS = { juve: '#c0293a', compare: '#1b3a8a', champion: '#b9965b', record: '#7d8199' } as const;

export default function LajuPoin() {
  const res = useFetch<LajuResponse>('/api/laju?league=ita.1');
  const d = res.data;
  const teams = d?.teams ?? [];
  const juve = teams.find(isJuve);
  const others = useMemo(() => teams.filter((t) => !isJuve(t)).sort((a, b) => b.points - a.points || a.position - b.position), [teams]);
  const [pick, setPick] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (res.loading) return <div className="kp-card kp-empty">Memuat hasil laga…</div>;
  if (res.error || !d || !juve) return <div className="kp-card kp-empty">Hasil laga Serie A belum bisa dimuat dari ESPN. Coba muat ulang beberapa saat lagi.</div>;

  const total = d.totalGames;
  const n = juve.series.length;
  if (n === 0) return <div className="kp-card kp-empty">Grafik laju poin muncul setelah Juventus memainkan laga pertamanya musim ini.</div>;

  const compare = others.find((t) => t.id === pick) ?? others[0];
  const sum = summarize(juve, total, d.champion, d.record);

  const maxV = Math.max(30, ...juve.series, ...(compare?.series ?? []), ...(d.champion?.series ?? []), ...(d.record?.series ?? []));
  const yMax = Math.ceil(maxV / 10) * 10;
  const x = (k: number) => L + (k / total) * (W - L - R);
  const y = (v: number) => H - B - (v / yMax) * (H - T - B);
  const line = (series: number[], upto = series.length) => `M${x(0)},${y(0)}` + series.slice(0, upto).map((v, i) => ` L${x(i + 1)},${y(v)}`).join('');
  const yTicks = Array.from({ length: yMax / 10 + 1 }, (_, i) => i * 10);
  const xTicks = [0, 5, 10, 15, 20, 25, 30, 35, total].filter((v, i, a) => a.indexOf(v) === i);

  const bench = (b: Benchmark | null) => (b ? `${b.team} ${b.season}` : '');
  const champLabel = d.champion ? `${bench(d.champion)} (juara)` : '';
  const recLabel = d.record ? `${bench(d.record)} (${d.record.total} poin)` : '';

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(1, Math.min(total, Math.round(((vx - L) / (W - L - R)) * total))));
  };
  const hv = hover;
  const at = (s: number[] | undefined) => (hv === null ? null : pointsAt(s, hv));

  return (
    <section className="kp-card lj">
      <header className="kp-card-head">
        <h2 className="kp-title">Laju poin</h2>
        <small className="kp-muted">
          Poin kumulatif per laga{d.champion ? ` vs musim juara ${d.champion.season}` : ''}{d.record ? ` & rekor ${d.record.season}` : ''}
        </small>
      </header>

      <div className="lj-tiles">
        <div className="lj-tile lj-hero">
          <small>Setelah {n} laga</small>
          <b>{sum.points} poin</b>
          <span>{dec(sum.ppg)} poin per laga</span>
        </div>
        {d.champion && (
          <div className="lj-tile">
            <small>vs musim juara {d.champion.season}</small>
            <b>{sum.vsChampion ? signed(sum.vsChampion.diff) : '–'}</b>
            <span>{sum.vsChampion ? `${sum.vsChampion.at} poin di titik yang sama` : 'Data belum cukup'}</span>
          </div>
        )}
        {d.record && (
          <div className="lj-tile">
            <small>vs rekor {d.record.total} poin</small>
            <b>{sum.vsRecord ? signed(sum.vsRecord.diff) : '–'}</b>
            <span>{sum.vsRecord ? `${sum.vsRecord.at} poin di titik yang sama (${d.record.season})` : 'Data belum cukup'}</span>
          </div>
        )}
        <div className="lj-tile">
          <small>Proyeksi {total} laga</small>
          <b>{sum.projected}</b>
          <span>{d.champion ? `${d.champion.season} selesai dengan ${d.champion.total} poin` : 'dari laju poin sekarang'}</span>
        </div>
      </div>

      <div className="lj-pick">
        <label htmlFor="lj-sel">Bandingkan dengan</label>
        <select id="lj-sel" value={compare?.id ?? ''} onChange={(e) => setPick(e.target.value)}>
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.points})
            </option>
          ))}
        </select>
      </div>

      <div className="lj-legend">
        <span><i style={{ background: COLORS.juve }} /> Juventus 2026/27</span>
        {compare && <span><i style={{ background: COLORS.compare }} /> {compare.name} (poin setelah {n} laga)</span>}
        {d.champion && <span><i className="dash" style={{ borderColor: COLORS.champion }} /> {champLabel}</span>}
        {d.record && <span><i className="dash" style={{ borderColor: COLORS.record }} /> {recLabel}</span>}
      </div>

      <div className="lj-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Poin kumulatif per laga" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="lj-grid" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" className="lj-axis">{v}</text>
            </g>
          ))}
          {xTicks.map((k) => (
            <text key={k} x={x(k)} y={H - 10} textAnchor="middle" className="lj-axis">{k}</text>
          ))}
          {d.record && <path d={line(d.record.series)} fill="none" stroke={COLORS.record} strokeWidth={2.5} strokeDasharray="6 5" />}
          {d.champion && <path d={line(d.champion.series)} fill="none" stroke={COLORS.champion} strokeWidth={2.5} strokeDasharray="6 5" />}
          {compare && compare.series.length > 0 && <path d={line(compare.series, n)} fill="none" stroke={COLORS.compare} strokeWidth={3} />}
          <path d={line(juve.series)} fill="none" stroke={COLORS.juve} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={x(n)} cy={y(sum.points)} r={8} fill={COLORS.juve} stroke="#fff" strokeWidth={2} />
          <text x={x(n) + 14} y={y(sum.points) - 8} className="lj-end">{sum.points}</text>
          {hv !== null && <line x1={x(hv)} x2={x(hv)} y1={T} y2={H - B} className="lj-hover" />}
          <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" />
        </svg>
        {hv !== null && (
          <div className="lj-tip" style={{ left: `${Math.min(78, Math.max(2, (x(hv) / W) * 100))}%` }}>
            <b>Setelah laga {hv}</b>
            {at(juve.series) !== null && <span style={{ color: COLORS.juve }}>Juventus: {at(juve.series)}</span>}
            {compare && at(compare.series) !== null && <span style={{ color: COLORS.compare }}>{compare.name}: {at(compare.series)}</span>}
            {d.champion && at(d.champion.series) !== null && <span style={{ color: COLORS.champion }}>{bench(d.champion)}: {at(d.champion.series)}</span>}
            {d.record && at(d.record.series) !== null && <span style={{ color: COLORS.record }}>{bench(d.record)}: {at(d.record.series)}</span>}
          </div>
        )}
      </div>

      {d.warnings.map((w) => (
        <p key={w} className="lj-warn">{w}</p>
      ))}
      <p className="lj-foot">
        Poin kumulatif dihitung dari hasil laga ESPN menurut urutan tanggal main (laga yang ditunda dihitung saat dimainkan), jadi “laga ke-n” bisa berbeda dari pekan resmi. Proyeksi {total} laga = laju poin sekarang × {total}, bukan simulasi
        (simulasinya ada di tab Peluang juara). {d.record ? `Musim rekor: ${d.record.team} ${d.record.season} (${d.record.total} poin). ` : ''}Garis klub pembanding hanya digambar sampai laga yang sama dengan Juventus.
      </p>
    </section>
  );
}
