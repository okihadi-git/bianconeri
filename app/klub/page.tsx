'use client';

import { useMemo } from 'react';
import { useFetch } from '@/components/kp';
import { PlayerAvatar, fmtEuro, fmtLeft, fmtMonthYear, monthsLeft } from '@/components/team';
import type { SquadResponse } from '@/lib/types';

export default function KontrakPage() {
  const res = useFetch<SquadResponse>('/api/squad');
  const players = res.data?.players ?? [];

  const view = useMemo(() => {
    const now = Date.now();
    const rows = players
      .filter((p) => p.contractUntil && !Number.isNaN(new Date(p.contractUntil).getTime()))
      .map((p) => ({ p, left: monthsLeft(p.contractUntil, now) as number }))
      .sort((a, b) => (a.p.contractUntil as string).localeCompare(b.p.contractUntil as string) || a.p.name.localeCompare(b.p.name));

    const soon = rows.filter((r) => r.left <= 12);
    const avg = rows.length ? rows.reduce((n, r) => n + Math.max(0, r.left), 0) / rows.length / 12 : null;
    const longest = rows.length ? rows[rows.length - 1] : null;

    const years: { year: string; items: typeof rows }[] = [];
    for (const r of rows) {
      const year = (r.p.contractUntil as string).slice(0, 4);
      const last = years[years.length - 1];
      if (last && last.year === year) last.items.push(r);
      else years.push({ year, items: [r] });
    }
    return { rows, soon, avg, longest, years };
  }, [players]);

  const src = res.data?.source === 'fotmob' ? 'FotMob' : 'Transfermarkt';
  const noData = players.length - view.rows.length;

  return (
    <div className="kp" id="kontrak">
      <div className="kp-metrics">
        <div className="kp-metric kp-metric-red">
          <div className="kp-metric-label">Berakhir dalam 12 bulan</div>
          <div className="kp-metric-val">{view.rows.length ? view.soon.length : '–'}</div>
          <div className="kp-metric-sub">
            {view.soon.length
              ? view.soon
                  .slice(0, 3)
                  .map((r) => r.p.name)
                  .join(', ') + (view.soon.length > 3 ? ` +${view.soon.length - 3} lainnya` : '')
              : res.loading
              ? 'Memuat data…'
              : 'Tidak ada yang tercatat'}
          </div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Rata-rata sisa kontrak</div>
          <div className="kp-metric-val">{view.avg != null ? `${view.avg.toFixed(1).replace('.', ',')} th` : '–'}</div>
          <div className="kp-metric-sub">Dihitung dari pemain yang punya data kontrak</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Kontrak terpanjang</div>
          <div className="kp-metric-val">{view.longest ? view.longest.p.contractUntil?.slice(0, 4) : '–'}</div>
          <div className="kp-metric-sub">
            {view.longest ? `${view.longest.p.name} · ${fmtMonthYear(view.longest.p.contractUntil)}` : '–'}
          </div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Data kontrak tersedia</div>
          <div className="kp-metric-val">{players.length ? `${view.rows.length}/${players.length}` : '–'}</div>
          <div className="kp-metric-sub">{res.data ? `Sumber: ${src}` : ' '}</div>
        </div>
      </div>

      <section className="kp-card">
        <header className="kp-card-head">
          <h2 className="kp-title">Kontrak pemain</h2>
          <small className="kp-muted">Diurutkan dari yang berakhir paling awal</small>
        </header>

        {res.loading ? (
          <div className="kp-empty">Memuat data kontrak…</div>
        ) : res.error || !players.length ? (
          <div className="kp-empty">
            Data kontrak belum bisa dimuat dari Transfermarkt maupun FotMob. Sumber ini tidak resmi dan kadang memblokir permintaan dari server; coba muat ulang beberapa saat lagi.
          </div>
        ) : !view.rows.length ? (
          <div className="kp-empty">Sumber data yang aktif ({src}) tidak menyediakan tanggal kontrak.</div>
        ) : (
          <div className="kp-table-wrap">
            <table className="kp-table ct-table">
              <thead>
                <tr>
                  <th className="c-club">Pemain</th>
                  <th>Posisi</th>
                  <th>Usia</th>
                  <th>Berakhir</th>
                  <th>Sisa</th>
                  <th>Nilai pasar</th>
                </tr>
              </thead>
              <tbody>
                {view.years.map((y) => (
                  <ContractYear key={y.year} year={y.year} items={y.items} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="kp-legend">
          <span className="kp-legend-note">
            Tanggal kontrak dan nilai pasar adalah estimasi {src}, bukan angka resmi klub. Gaji pemain tidak ditampilkan karena tidak disediakan sumber data.
            {noData > 0 ? ` ${noData} pemain tanpa tanggal kontrak tidak masuk daftar.` : ''} Sisa kontrak dihitung dari tanggal hari ini; yang tersisa 12 bulan atau kurang ditandai pink.
          </span>
        </footer>
      </section>
    </div>
  );
}

function ContractYear({ year, items }: { year: string; items: { p: SquadResponse['players'][number]; left: number }[] }) {
  return (
    <>
      <tr className="ct-year">
        <td colSpan={6}>
          Berakhir {year} · {items.length} pemain
        </td>
      </tr>
      {items.map(({ p, left }) => (
        <tr key={p.id}>
          <td className="c-club">
            <div className="ct-player">
              <PlayerAvatar p={p} />
              <b>{p.name}</b>
            </div>
          </td>
          <td>{p.position || '–'}</td>
          <td>{p.age ?? '–'}</td>
          <td>{fmtMonthYear(p.contractUntil)}</td>
          <td>
            <span className={`ct-left${left <= 12 ? ' soon' : ''}`}>{fmtLeft(left)}</span>
          </td>
          <td>{fmtEuro(p.marketValue)}</td>
        </tr>
      ))}
    </>
  );
}
