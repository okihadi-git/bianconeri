'use client';

import { useFetch } from '@/components/kp';
import type { DisiplinResponse } from '@/lib/disiplin';
import './disiplin.css';

const dec = (n: number) => n.toFixed(2).replace('.', ',');
const dec1 = (n: number) => n.toFixed(1).replace('.', ',');

function Cards({ y, r }: { y: number; r: number }) {
  if (!y && !r) return null;
  return (
    <span className="dc-cards" aria-label={`${y} kartu kuning, ${r} kartu merah`}>
      {Array.from({ length: Math.min(y, 6) }, (_, i) => <i key={`y${i}`} className="dc-y" title="Kartu kuning" />)}
      {Array.from({ length: Math.min(r, 3) }, (_, i) => <i key={`r${i}`} className="dc-r" title="Kartu merah" />)}
    </span>
  );
}

function Bars({ rows, tone }: { rows: { id: string; name: string; per90: number; y?: number; r?: number }[]; tone: 'warm' | 'green' }) {
  const max = Math.max(0.01, ...rows.map((x) => x.per90));
  return (
    <ul className="dc-list">
      {rows.map((p) => (
        <li key={p.id}>
          <span className="dc-name">
            {p.name}
            {p.y != null ? <Cards y={p.y} r={p.r ?? 0} /> : null}
          </span>
          <div className={`dc-bar ${tone}`}><i style={{ width: `${(p.per90 / max) * 100}%` }} /></div>
          <b>{dec(p.per90)}</b>
        </li>
      ))}
    </ul>
  );
}

/** Statistik → Analitik → 12 Disiplin (pelanggaran, kartu, offside). */
export default function Disiplin() {
  const res = useFetch<DisiplinResponse>('/api/analitik/disiplin');
  const d = res.data;

  return (
    <section className="dc">
      <header className="dc-head">
        <span className="dc-numtag">12</span>
        <h2>DISIPLIN</h2>
        <small>Pelanggaran, kartu, offside</small>
      </header>

      {res.loading ? <div className="dc-empty">Memuat statistik disiplin… (pertama kali bisa beberapa detik)</div> : null}
      {!res.loading && (res.error || !d) ? <div className="dc-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && !res.loading ? (
        d.matches === 0 ? (
          <div className="dc-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
        ) : (
          <>
            <div className="dc-tiles">
              <div className="dc-tile hero">
                <small>PELANGGARAN PER LAGA</small>
                <b>{d.fouls.perGame != null ? dec1(d.fouls.perGame) : '–'}</b>
                <span>{d.fouls.total} total</span>
              </div>
              <div className="dc-tile">
                <small>KARTU KUNING</small>
                <b>{d.cards.yellow}</b>
                <span>merah: {d.cards.red}</span>
              </div>
              <div className="dc-tile">
                <small>OFFSIDE</small>
                <b>{d.offsides.total}</b>
                <span>{d.offsides.perGame != null ? `${dec1(d.offsides.perGame)} per laga` : 'tidak tercatat'}</span>
              </div>
              <div className="dc-tile">
                <small>PALING SERING DILANGGAR</small>
                <b className="dc-who">{d.mostFouled ? d.mostFouled.name.trim().split(/\s+/).slice(-1)[0] : '–'}</b>
                <span>{d.mostFouled ? `${dec1(d.mostFouled.per90)} per 90 menit` : 'data belum tersedia'}</span>
              </div>
            </div>

            <div className="dc-cols">
              <div>
                <h3>Melakukan pelanggaran (per 90&apos;)</h3>
                {d.committed.length ? <Bars tone="warm" rows={d.committed.map((p) => ({ id: p.id, name: p.name, per90: p.per90, y: p.yellow, r: p.red }))} /> : <div className="dc-empty small">Belum ada data pelanggaran per pemain.</div>}
              </div>
              <div>
                <h3>Dilanggar / memenangkan tendangan bebas (per 90&apos;)</h3>
                {d.fouled.length ? <Bars tone="green" rows={d.fouled.map((p) => ({ id: p.id, name: p.name, per90: p.per90 }))} /> : <div className="dc-empty small">Belum ada data pemain yang dilanggar.</div>}
              </div>
            </div>

            <p className="dc-note">
              Pelanggaran, kartu, dan offside tim dari statistik laga FotMob ({d.matches} laga resmi{d.cards.fromTeamStats ? '' : '; kartu dihitung dari kejadian laga per pemain'}); angka per pemain dari statistik pemain FotMob. Minimal {d.minMinutes} menit bermain. Ikon di samping nama = kartu kuning/merah pemain itu musim ini.
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
