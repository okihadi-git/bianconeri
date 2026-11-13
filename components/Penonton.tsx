'use client';

import { useFetch } from '@/components/kp';
import type { PenontonResponse } from '@/lib/penonton';
import './penonton.css';

const dash = '–';
const int = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const num = (n: number | null) => (n == null ? dash : int(n));

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'dark' }) {
  return (
    <div className={`kn-tile${tone ? ` ${tone}` : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

/** Statistik → Analisa → Penonton (laga resmi sejak awal musim). */
export default function Penonton() {
  const res = useFetch<PenontonResponse>('/api/analisa/penonton');
  const d = res.data;
  if (res.loading) return <div className="kp-card kp-empty">Memuat data penonton… (pertama kali bisa beberapa detik)</div>;
  if (res.error || !d) return <div className="kp-card kp-empty">Data penonton belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div>;
  if (!d.rows.length) return <div className="kp-card kp-empty">{d.warnings[0] ?? 'Belum ada laga resmi yang selesai.'}</div>;

  return (
    <section className="kp-card kn">
      <header className="kp-card-head">
        <h2 className="kp-title">Jumlah penonton</h2>
        <small className="kp-muted">Penonton tiap laga, kandang vs tandang, kapasitas {d.stadium.name.replace(/ Stadium$/, '')}</small>
      </header>

      <div className="kn-tiles">
        <Tile
          tone="dark"
          label="Rata-rata kandang"
          value={num(d.homeAvg)}
          sub={d.homeFill == null ? 'belum ada data kandang' : `${d.homeFill}% kapasitas ${d.stadium.name} (${int(d.stadium.capacity)})`}
        />
        <Tile label="Rata-rata tandang" value={num(d.awayAvg)} sub={`${d.awayMatches} laga`} />
        <Tile label="Terbanyak" value={d.top ? int(d.top.attendance) : dash} sub={d.top ? [d.top.opp, d.top.venue].filter(Boolean).join(' · ') : undefined} />
        <Tile label="Total penonton" value={d.counted ? int(d.total) : dash} sub={`${d.counted} laga`} />
      </div>

      <div className="kn-tablewrap">
        <table className="kn-table">
          <thead>
            <tr>
              <th>LAGA</th>
              <th>STADION</th>
              <th>PENONTON</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <b>
                    {r.home || r.neutral ? 'vs' : 'di'} {r.opp}
                  </b>
                  <small>
                    {r.dateLabel} · {r.league} · {r.score}
                  </small>
                </td>
                <td>{r.venue || dash}</td>
                <td className="kn-att">{num(r.attendance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="kn-note">
        Hanya pertandingan resmi sejak awal musim sampai laga selesai terbaru ({d.rows.length} laga); laga persahabatan/ujicoba tidak dihitung. Sumber: ESPN. Kapasitas {d.stadium.name} {int(d.stadium.capacity)} (diisi manual).
        {d.warnings.map((w) => ` ${w}`).join('')}
      </p>
    </section>
  );
}
