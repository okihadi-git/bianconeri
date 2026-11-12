'use client';

import { useState } from 'react';
import { useFetch } from '@/components/kp';
import { buildPola, compOptions, h2Insight, lateInsight, type PolaResponse, type PolaStats, type Wdl } from '@/lib/pola';
import './pola.css';

const dash = '–';
const dec = (n: number | null) => (n == null ? dash : n.toFixed(2).replace('.', ','));
const rec = (t: Wdl) => `${t.w}-${t.d}-${t.l}`;
const score = (t: { gf: number; ga: number }) => `${t.gf}–${t.ga}`;

function Tile({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'dark' | 'warm' }) {
  return (
    <div className={`pl-tile${tone ? ` ${tone}` : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

function GoalChart({ bins }: { bins: PolaStats['bins'] }) {
  const W = 1100;
  const H = 330;
  const L = 44;
  const R = 12;
  const T = 14;
  const B = 62;
  const max = Math.max(2, ...bins.map((b) => Math.max(b.gf, b.ga)));
  const yMax = Math.ceil(max / 2) * 2;
  const y = (v: number) => T + (1 - v / yMax) * (H - T - B);
  const slot = (W - L - R) / bins.length;
  const bw = Math.min(46, slot / 3);
  const ticks = Array.from({ length: yMax / 2 + 1 }, (_, i) => i * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-svg" role="img" aria-label={`Gol Juventus dan kebobolan per rentang menit: ${bins.map((b) => `${b.label} ${b.gf}–${b.ga}`).join(', ')}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="pl-grid" />
          <text x={L - 10} y={y(t) + 5} textAnchor="end" className="pl-axis">{t}</text>
        </g>
      ))}
      {bins.map((b, i) => {
        const cx = L + slot * i + slot / 2;
        const bar = (v: number, x: number, cls: string, name: string) =>
          v > 0 ? (
            <rect x={x} y={y(v)} width={bw} height={y(0) - y(v)} rx={4} className={cls}>
              <title>{`${name}: ${v} gol (menit ${b.label})`}</title>
            </rect>
          ) : null;
        return (
          <g key={b.label}>
            {bar(b.gf, cx - bw - 2, 'pl-bar-for', 'Gol Juventus')}
            {bar(b.ga, cx + 2, 'pl-bar-ag', 'Kebobolan')}
            <text x={cx} y={H - 32} textAnchor="middle" className="pl-xl">{b.label}</text>
            <text x={cx} y={H - 10} textAnchor="middle" className="pl-xr">{`${b.gf}–${b.ga}`}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Statistik → Analisa → Pola laga. */
export default function PolaLaga() {
  const res = useFetch<PolaResponse>('/api/analisa/pola');
  const [comp, setComp] = useState('all');
  const d = res.data;
  if (res.loading) return <div className="kp-card kp-empty">Memuat pola laga… (pertama kali bisa beberapa detik)</div>;
  if (res.error || !d) return <div className="kp-card kp-empty">Data pola laga belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div>;
  if (!d.games.length) return <div className="kp-card kp-empty">{d.warnings[0] ?? 'Belum ada laga Juventus yang selesai.'}</div>;

  const opts = compOptions(d.games);
  const active = opts.some((o) => o.key === comp) ? comp : 'all';
  const s = buildPola(d.games, d.positions, active);
  const hasTl = s.nTimeline > 0;
  const st = s.state;
  const winPct = (t: Wdl) => (t.n ? Math.round((t.w / t.n) * 100) : null);

  return (
    <section className="kp-card pl">
      <header className="kp-card-head">
        <h2 className="kp-title">Pola laga</h2>
        <small className="kp-muted">Waktu gol, situasi skor, kandang/tandang, level lawan</small>
      </header>

      <div className="pl-chips" role="group" aria-label="Kompetisi">
        {opts.map((o) => (
          <button key={o.key} type="button" aria-pressed={active === o.key} className={`pl-chip${active === o.key ? ' on' : ''}`} onClick={() => setComp(o.key)}>
            {o.label}
          </button>
        ))}
      </div>

      <h3 className="pl-h">Peta waktu gol</h3>
      <div className="pl-tiles">
        <Tile label="Babak pertama" value={hasTl ? score(s.h1) : dash} sub="gol dicetak–kebobolan" />
        <Tile label="Babak kedua" value={hasTl ? score(s.h2) : dash} sub={hasTl ? h2Insight(s.h1, s.h2) : undefined} tone="dark" />
        <Tile label="Menit 76–90+" value={hasTl ? score(s.late) : dash} sub={hasTl ? lateInsight(s.late) : undefined} />
        <Tile label="Laga" value={s.n} sub={hasTl && s.nTimeline < s.n ? `menit gol tersedia di ${s.nTimeline} laga` : undefined} />
      </div>
      {hasTl ? (
        <>
          <p className="pl-legend"><i className="for" /> Gol Juventus <i className="ag" /> Kebobolan</p>
          <div className="pl-chart"><GoalChart bins={s.bins} /></div>
        </>
      ) : (
        <p className="pl-none">Menit gol belum tersedia untuk laga-laga ini di data ESPN.</p>
      )}

      <h3 className="pl-h">Situasi skor</h3>
      <div className="pl-tiles">
        <Tile tone="dark" label="Cetak gol duluan" value={st ? `${st.scoredFirst.n} laga` : dash} sub={st ? `hasil ${rec(st.scoredFirst)}${winPct(st.scoredFirst) != null ? ` · menang ${winPct(st.scoredFirst)}%` : ''}` : undefined} />
        <Tile tone="warm" label="Kebobolan duluan" value={st ? `${st.concededFirst.n} laga` : dash} sub={st ? `hasil ${rec(st.concededFirst)}` : undefined} />
        <Tile label="Poin dari posisi tertinggal" value={st ? st.behindPts : dash} sub={st ? `${st.comebacks} laga comeback` : undefined} />
        <Tile label="Poin hilang saat unggul" value={st ? st.lostPts : dash} sub="sempat unggul lalu gagal menang" />
        <Tile label="Unggul saat jeda" value={st ? st.leadHt.n : dash} sub={st ? `${st.leadHt.w} berakhir menang` : undefined} />
        <Tile label="Imbang saat jeda" value={st ? st.levelHt.n : dash} sub={st ? `hasil ${rec(st.levelHt)}` : undefined} />
        <Tile label="Tertinggal saat jeda" value={st ? st.trailHt.n : dash} sub={st ? `hasil ${rec(st.trailHt)}` : undefined} />
        <Tile label="Clean sheet" value={s.cleanSheets} sub={`gagal cetak gol: ${s.failedToScore}`} />
      </div>

      <h3 className="pl-h">Kandang, tandang, dan level lawan</h3>
      <div className="pl-tablewrap">
        <table className="pl-table">
          <thead>
            <tr>
              <th />
              <th>LAGA</th>
              <th>M-S-K</th>
              <th>GOL</th>
              <th>POIN/LAGA</th>
              <th>XG/LAGA</th>
              <th>XGA/LAGA</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>{r.n}</td>
                <td>{`${r.w}-${r.d}-${r.l}`}</td>
                <td>{`${r.gf}–${r.ga}`}</td>
                <td className="pl-ppg">{dec(r.ppg)}</td>
                <td>{dec(r.xg)}</td>
                <td>{dec(r.xga)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="pl-note">
        Dihitung otomatis dari menit gol tiap laga (ESPN). Level lawan memakai posisi klasemen Serie A saat ini dan hanya untuk laga liga; xG dari FotMob dan dirata-rata hanya dari laga yang punya xG. Gol di perpanjangan waktu tidak masuk peta waktu; laga yang berakhir lewat adu penalti dihitung seri. Sampel awal musim masih kecil, jadi pola bisa berubah cepat.
        {d.warnings.map((w: string) => ` ${w}`).join('')}
      </p>
    </section>
  );
}
