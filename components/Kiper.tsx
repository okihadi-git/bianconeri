'use client';

import { useFetch } from '@/components/kp';
import type { KeeperRow, KiperResponse } from '@/lib/kiper';
import './kiper.css';

const dash = '–';
const id1 = (n: number) => n.toFixed(1).replace('.', ',');
const signed1 = (n: number) => `${n > 0 ? '+' : ''}${id1(n)}`;
const mins = (n: number) => n.toLocaleString('id-ID');
const pct = (n: number | null) => (n == null ? dash : `${Math.round(n * 100)}%`);
const lastName = (name: string) => name.trim().split(/\s+/).slice(-1)[0] ?? name;

function Tile({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'dark' }) {
  return (
    <div className={`kg-tile${tone ? ` ${tone}` : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

/** Statistik → Analisa → Kiper. */
export default function Kiper() {
  const res = useFetch<KiperResponse>('/api/analisa/kiper');
  const d = res.data;
  if (res.loading) return <div className="kp-card kp-empty">Memuat analisa kiper… (pertama kali bisa beberapa detik)</div>;
  if (res.error || !d) return <div className="kp-card kp-empty">Data kiper belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div>;
  if (!d.keepers.length) return <div className="kp-card kp-empty">{d.warnings[0] ?? 'Belum ada data kiper.'}</div>;

  const main: KeeperRow = d.keepers.find((k) => k.id === d.mainId) ?? d.keepers[0];

  return (
    <section className="kp-card kg">
      <header className="kp-card-head">
        <h2 className="kp-title">Analisa kiper</h2>
        <small className="kp-muted">Penyelamatan, clean sheet, gol dicegah dibanding xG</small>
      </header>

      <h3 className="kg-h">Statistik kiper (semua kompetisi)</h3>
      <div className="kg-tiles">
        <Tile tone="dark" label="Kiper utama" value={lastName(main.name)} sub={`${main.started} start · ${mins(main.minutes)} menit`} />
        <Tile label="Persentase penyelamatan" value={pct(main.savePct)} sub={`${main.saves} penyelamatan · ${main.conceded} kebobolan`} />
        <Tile label="Clean sheet" value={main.cleanSheets} sub={main.started ? `${Math.round((main.cleanSheets / main.started) * 100)}% dari laga start` : undefined} />
        <Tile
          label="Gol dicegah"
          value={main.prevented == null ? dash : signed1(main.prevented)}
          sub={main.prevented == null || main.xgFaced == null ? 'xG lawan belum tersedia' : `xG lawan ${id1(main.xgFaced)} vs kebobolan ${main.concededXg}`}
        />
      </div>

      <div className="kg-tablewrap">
        <table className="kg-table">
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
                <td>{mins(k.minutes)}</td>
                <td>{k.saves}</td>
                <td>{k.conceded}</td>
                <td>{pct(k.savePct)}</td>
                <td>{k.cleanSheets}</td>
                <td>{k.prevented == null ? dash : id1(k.prevented)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="kg-note">
        &quot;Gol dicegah&quot; = total xG lawan di laga yang dimulai kiper itu dikurangi gol yang ia kebobolan. Positif berarti kiper menyelamatkan lebih banyak dari perkiraan. Clean sheet dihitung bila kiper main minimal 85 menit tanpa kebobolan.
        % selamat = penyelamatan ÷ (penyelamatan + kebobolan). Sumber: ESPN (menit, penyelamatan, kebobolan), xG lawan dari FotMob; {d.matches} laga.
        {d.warnings.map((w) => ` ${w}`).join('')}
      </p>
    </section>
  );
}
