'use client';

import type { KeeperRow, KiperResponse } from '@/lib/analisa/kiper';
import { DASH, dec, int, signed } from '@/lib/analisa/util';
import { Card, Empty, Tile, useTab } from './ui';

const pct = (n: number | null) => (n == null ? DASH : `${Math.round(n * 100)}%`);
const lastName = (name: string) => name.trim().split(/\s+/).slice(-1)[0] ?? name;

/** Statistik → Analisa → Kiper (hanya kiper). */
export default function Kiper() {
  const { data: d, fallback } = useTab<KiperResponse>('/api/analisa/kiper', 'Memuat analisa kiper… (pertama kali bisa beberapa detik)', 'Data kiper belum bisa dimuat. Coba muat ulang beberapa saat lagi.');
  if (!d) return fallback;
  if (!d.keepers.length) return <Empty>{d.warnings[0] ?? 'Belum ada data kiper.'}</Empty>;

  const main: KeeperRow = d.keepers.find((k) => k.id === d.mainId) ?? d.keepers[0];

  return (
    <Card title="Analisa kiper" sub="Penyelamatan, clean sheet, gol dicegah dibanding xG">
      <h3 className="an-h">Statistik kiper (semua kompetisi)</h3>
      <div className="an-tiles">
        <Tile tone="dark" label="Kiper utama" value={lastName(main.name)} sub={`${main.started} start · ${int(main.minutes)} menit`} />
        <Tile label="Persentase penyelamatan" value={pct(main.savePct)} sub={`${main.saves} penyelamatan · ${main.conceded} kebobolan`} />
        <Tile label="Clean sheet" value={main.cleanSheets} sub={main.started ? `${Math.round((main.cleanSheets / main.started) * 100)}% dari laga start` : undefined} />
        <Tile
          label="Gol dicegah"
          value={main.prevented == null ? DASH : signed(main.prevented, 1)}
          sub={main.prevented == null || main.xgFaced == null ? 'xG lawan belum tersedia' : `xG lawan ${dec(main.xgFaced, 1)} vs kebobolan ${main.concededXg}`}
        />
      </div>

      <div className="an-tablewrap">
        <table className="an-table names">
          <thead>
            <tr>
              <th>KIPER</th>
              <th>MAIN</th>
              <th>START</th>
              <th>MENIT</th>
              <th>PENYELAMATAN</th>
              <th>KEBOBOLAN</th>
              <th>% SELAMAT</th>
              <th>CLEAN SHEET</th>
              <th>XG LAWAN − KEBOBOLAN</th>
            </tr>
          </thead>
          <tbody>
            {d.keepers.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td>{k.played}</td>
                <td>{k.started}</td>
                <td>{int(k.minutes)}</td>
                <td>{k.saves}</td>
                <td>{k.conceded}</td>
                <td>{pct(k.savePct)}</td>
                <td>{k.cleanSheets}</td>
                <td>{dec(k.prevented, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="an-note">
        &quot;Gol dicegah&quot; = total xG lawan di laga yang dimulai kiper itu dikurangi gol yang ia kebobolan. Positif berarti kiper menyelamatkan lebih banyak dari perkiraan. Clean sheet dihitung bila kiper main minimal 85 menit tanpa kebobolan.
        % selamat = penyelamatan ÷ (penyelamatan + kebobolan). Hanya kiper yang dihitung. Sumber: ESPN (menit, penyelamatan, kebobolan), xG lawan dari FotMob; {d.matches} laga.
        {d.warnings.map((w) => ` ${w}`).join('')}
      </p>
    </Card>
  );
}
