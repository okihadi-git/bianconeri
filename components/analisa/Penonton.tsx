'use client';

import type { PenontonResponse } from '@/lib/analisa/penonton';
import { DASH, int } from '@/lib/analisa/util';
import { Card, Empty, Tile, useTab } from './ui';

const num = (n: number | null) => (n == null ? DASH : int(n));

/** Statistik → Analisa → Penonton (laga resmi sejak awal musim). */
export default function Penonton() {
  const { data: d, fallback } = useTab<PenontonResponse>('/api/analisa/penonton', 'Memuat data penonton… (pertama kali bisa beberapa detik)', 'Data penonton belum bisa dimuat. Coba muat ulang beberapa saat lagi.');
  if (!d) return fallback;
  if (!d.rows.length) return <Empty>{d.warnings[0] ?? 'Belum ada laga resmi yang selesai.'}</Empty>;

  return (
    <Card title="Jumlah penonton" sub={`Penonton tiap laga, kandang vs tandang, kapasitas ${d.stadium.name.replace(/ Stadium$/, '')}`}>
      <div className="an-tiles top">
        <Tile
          tone="dark"
          label="Rata-rata kandang"
          value={num(d.homeAvg)}
          sub={d.homeFill == null ? 'belum ada data kandang' : `${d.homeFill}% kapasitas ${d.stadium.name} (${int(d.stadium.capacity)})`}
        />
        <Tile label="Rata-rata tandang" value={num(d.awayAvg)} sub={`${d.awayMatches} laga`} />
        <Tile label="Terbanyak" value={d.top ? int(d.top.attendance) : DASH} sub={d.top ? [d.top.opp, d.top.venue].filter(Boolean).join(' · ') : undefined} />
        <Tile label="Total penonton" value={d.counted ? int(d.total) : DASH} sub={`${d.counted} laga`} />
      </div>

      <div className="an-tablewrap">
        <table className="an-table">
          <thead>
            <tr>
              <th>LAGA</th>
              <th className="l">STADION</th>
              <th>PENONTON</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r) => (
              <tr key={r.id}>
                <td className="two">
                  <b>
                    {r.home || r.neutral ? 'vs' : 'di'} {r.opp}
                  </b>
                  <small>
                    {r.dateLabel} · {r.league} · {r.score}
                  </small>
                </td>
                <td className="l">{r.venue || DASH}</td>
                <td className="att">{num(r.attendance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="an-note">
        Hanya pertandingan resmi sejak awal musim sampai laga selesai terbaru ({d.rows.length} laga); laga persahabatan/ujicoba tidak dihitung. Sumber: ESPN. Kapasitas {d.stadium.name} {int(d.stadium.capacity)} (diisi manual).
        {d.warnings.map((w) => ` ${w}`).join('')}
      </p>
    </Card>
  );
}
