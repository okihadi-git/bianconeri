'use client';

import type { KeuanganResponse } from '@/lib/analisa/keuangan';
import { DASH, dec, int } from '@/lib/analisa/util';
import { Card, Tile, useTab } from './ui';

const eur = (n: number | null | undefined) => (n == null ? DASH : n >= 1e6 ? `€${dec(n / 1e6, 1)} jt` : n >= 1e3 ? `€${int(n / 1e3)} rb` : `€${int(n)}`);
const until = (iso: string | null) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d).replace('.', '') : DASH;
};

/** Statistik → Analisa → Peringkat & keuangan → Keuangan klub. */
export default function Keuangan() {
  const { data: d, fallback } = useTab<KeuanganResponse>('/api/analisa/keuangan', 'Memuat data keuangan…', 'Data keuangan belum bisa dimuat. Coba muat ulang beberapa saat lagi.');
  if (!d) return fallback;
  const { revenue: r, squad, wages } = d;

  return (
    <Card title="Keuangan klub" sub="Pendapatan, gaji, dan nilai pasar skuad">
      <h3 className="an-h">Ringkasan</h3>
      <div className="an-tiles">
        <Tile tone="dark" label={`Pendapatan ${r.season}`} value={`€${dec(r.total, 1)} jt`} sub={`#${r.rank} ${r.edition.replace('Deloitte ', '')} · siaran ${dec(r.broadcast, 1)} · komersial ${dec(r.commercial, 1)} · matchday ${dec(r.matchday, 1)} (jt)`} />
        <Tile label="Total gaji bruto / tahun" value={wages ? eur(wages.yearTotal) : DASH} sub={wages ? `${wages.matched} dari ${wages.of} pemain skuad punya data gaji` : 'data gaji belum tersedia'} />
        <Tile label="Nilai pasar skuad" value={eur(squad?.totalValue)} sub={squad?.top ? `termahal: ${squad.top.name} (${eur(squad.top.value)})` : undefined} />
        <Tile label="Kontrak habis ≤ 12 bulan" value={squad ? `${squad.ending.count} pemain` : DASH} sub={squad?.ending.value != null ? `nilai pasar ${eur(squad.ending.value)}` : undefined} />
      </div>

      {wages ? (
        <>
          <h3 className="an-h">Gaji tertinggi di skuad</h3>
          <div className="an-tablewrap">
            <table className="an-table names">
              <thead>
                <tr>
                  <th>PEMAIN</th>
                  <th>GAJI / TAHUN</th>
                  <th>GAJI / PEKAN</th>
                  <th>NILAI PASAR</th>
                  <th>KONTRAK SAMPAI</th>
                </tr>
              </thead>
              <tbody>
                {wages.top.map((w) => (
                  <tr key={w.name}>
                    <td>{w.name}</td>
                    <td>{eur(w.yearly)}</td>
                    <td>{eur(w.weekly)}</td>
                    <td>{eur(w.marketValue)}</td>
                    <td>{until(w.until)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <p className="an-note">
        Pendapatan: {r.edition} (musim {r.season}), diisi manual setiap edisi baru terbit. Gaji: tabel gaji project (bruto per tahun) untuk pemain yang datanya ada; bukan total gaji klub (staf dan lainnya tidak termasuk). Nilai pasar dan kontrak: {squad ? (squad.source === 'transfermarkt' ? 'Transfermarkt' : 'FotMob') : 'Transfermarkt/FotMob'}.
        {d.warnings.map((w: string) => ` ${w}`).join('')}
      </p>
    </Card>
  );
}
