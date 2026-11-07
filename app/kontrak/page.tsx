'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFetch } from '@/components/kp';
import PlayerModal from '@/components/PlayerModal';
import { fmtEuro, fmtLeft, fmtMonthYear, monthsLeft, PlayerAvatar } from '@/components/team';
import type { PlayerStatsResponse } from '@/lib/playerstats';
import { positionId, seasonsLeft } from '@/lib/playerprofile';
import { salaryFrom, weeklyOf, yearlyOf, type Salary, type SalaryResponse } from '@/lib/salaries';
import type { SquadPlayer, SquadResponse } from '@/lib/types';

type SortKey = 'salary' | 'contract' | 'value';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'salary', label: 'Gaji tertinggi' },
  { key: 'contract', label: 'Kontrak berakhir lebih dulu' },
  { key: 'value', label: 'Nilai pasar tertinggi' },
];

const STATUS: Record<string, string> = { LOAN: 'Pinjaman', INACTIVE: 'Tidak aktif' };

interface Row {
  p: SquadPlayer;
  s: Salary | null;
  yearly: number | null;
  weekly: number | null;
  /** kontrak: tanggal dari skuad (Transfermarkt/FotMob), cadangan dari tabel gaji */
  until: string | null;
}

/** €12,5 jt untuk angka besar; ribuan dibulatkan */
const k = (n: number | null) => (n == null ? '–' : fmtEuro(Math.round(n / 1000) * 1000));

export default function KontrakPage() {
  const squad = useFetch<SquadResponse>('/api/squad');
  const sal = useFetch<SalaryResponse>('/api/gaji');
  const [sort, setSort] = useState<SortKey>('salary');
  const [selected, setSelected] = useState<SquadPlayer | null>(null);
  // Statistik (ESPN) baru dimuat saat popup pertama dibuka.
  const [wantStats, setWantStats] = useState(false);
  const stats = useFetch<PlayerStatsResponse>(wantStats ? '/api/juventus/stats' : null);
  const closePlayer = useCallback(() => setSelected(null), []);

  const now = useMemo(() => new Date(), []);
  const players = squad.data?.players ?? [];
  const salaries = sal.data?.salaries ?? [];
  const src = squad.data?.source === 'fotmob' ? 'FotMob' : 'Transfermarkt';

  const rows: Row[] = useMemo(() => {
    const all = players.map((p) => {
      const s = salaryFrom(salaries, { name: p.name, ids: squad.data?.source === 'fotmob' ? { fotmob: p.id } : { tm: p.id } });
      return { p, s, yearly: s ? yearlyOf(s) : null, weekly: s ? weeklyOf(s) : null, until: p.contractUntil ?? s?.expiration ?? null };
    });
    const by = (a: Row, b: Row) => {
      if (sort === 'salary') return (b.yearly ?? -1) - (a.yearly ?? -1);
      if (sort === 'value') return (b.p.marketValue ?? -1) - (a.p.marketValue ?? -1);
      return (a.until ?? '9999').localeCompare(b.until ?? '9999');
    };
    return all.sort((a, b) => by(a, b) || a.p.name.localeCompare(b.p.name));
  }, [players, salaries, sort]);

  const withSalary = rows.filter((r) => r.yearly != null);
  const total = withSalary.reduce((n, r) => n + (r.yearly ?? 0), 0);
  const top = withSalary.reduce<Row | null>((best, r) => (!best || (r.yearly ?? 0) > (best.yearly ?? 0) ? r : best), null);
  const expiring = rows.filter((r) => r.until && seasonsLeft(r.until, now) === 1);
  const loans = rows.filter((r) => r.s?.status === 'LOAN');
  // Baris tabel gaji yang tidak ketemu di skuad (mis. pemain yang sudah pergi); ditampilkan agar tidak hilang diam-diam.
  const matched = new Set(withSalary.map((r) => r.s));
  const unmatched = salaries.filter((s) => !matched.has(s));

  const names = (list: Row[]) => (list.length ? list.slice(0, 3).map((r) => r.p.name).join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '') : 'Tidak ada');
  const loading = squad.loading || sal.loading;

  return (
    <div className="kp" id="kontrak">
      <div className="kp-metrics">
        <div className="kp-metric kp-metric-red">
          <div className="kp-metric-label">Total gaji kotor / tahun</div>
          <div className="kp-metric-val">{withSalary.length ? fmtEuro(total) : '–'}</div>
          <div className="kp-metric-sub">{withSalary.length ? `${withSalary.length} dari ${players.length} pemain punya data gaji` : loading ? 'Memuat data…' : 'Data gaji belum tersedia'}</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Gaji tertinggi</div>
          <div className="kp-metric-val sq-coach">{top?.p.name ?? '–'}</div>
          <div className="kp-metric-sub">{top ? `${fmtEuro(top.yearly)} per tahun` : ' '}</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Kontrak habis musim ini</div>
          <div className="kp-metric-val">{players.length ? expiring.length : '–'}</div>
          <div className="kp-metric-sub">{players.length ? names(expiring) : ' '}</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Pemain pinjaman</div>
          <div className="kp-metric-val">{salaries.length ? loans.length : '–'}</div>
          <div className="kp-metric-sub">{salaries.length ? names(loans) : ' '}</div>
        </div>
      </div>

      <section className="kp-card">
        <header className="kp-card-head">
          <h2 className="kp-title">Kontrak & gaji</h2>
          <small className="kp-muted">Klik pemain untuk profil lengkap</small>
        </header>

        {players.length > 0 && (
          <div className="sq-toolbar">
            <div className="sq-chips">
              {SORTS.map((s) => (
                <button key={s.key} className={`sq-chip${sort === s.key ? ' active' : ''}`} onClick={() => setSort(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {squad.loading ? (
          <div className="kp-empty">Memuat skuad…</div>
        ) : squad.error || !players.length ? (
          <div className="kp-empty">Skuad belum bisa dimuat dari Transfermarkt maupun FotMob. Coba muat ulang beberapa saat lagi.</div>
        ) : (
          <div className="kp-table-wrap">
            <table className="kp-table kt-table">
              <thead>
                <tr>
                  <th className="kt-left">Pemain</th>
                  <th>Gaji / pekan</th>
                  <th>Gaji / tahun</th>
                  <th>Bonus / tahun</th>
                  <th>Kontrak sampai</th>
                  <th>Sisa</th>
                  <th>Nilai pasar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, s, yearly, weekly, until }) => (
                  <tr key={p.id}>
                    <td className="kt-left">
                      <button
                        type="button"
                        className="kt-player"
                        onClick={() => {
                          setWantStats(true);
                          setSelected(p);
                        }}
                        aria-haspopup="dialog"
                        aria-label={`Lihat profil ${p.name}`}
                      >
                        <PlayerAvatar p={p} />
                        <span>
                          <b>{p.name}</b>
                          {s && STATUS[s.status ?? ''] && <em className={`kt-tag kt-${s.status}`}>{STATUS[s.status ?? '']}</em>}
                          <small className="kp-muted">{[positionId(p.position), p.age != null ? `${p.age} th` : ''].filter(Boolean).join(' · ')}</small>
                        </span>
                      </button>
                    </td>
                    <td>{k(weekly)}</td>
                    <td>
                      <b>{k(yearly)}</b>
                    </td>
                    <td>{k(s?.bonusPerYear ?? null)}</td>
                    <td>{fmtMonthYear(until)}</td>
                    <td>{fmtLeft(monthsLeft(until, now.getTime()))}</td>
                    <td>{fmtEuro(p.marketValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="kp-legend">
          <span className="kp-legend-note">
            Gaji kotor (sebelum pajak) berupa estimasi {salaries[0]?.source || 'pihak ketiga'} dari database proyek ini, bukan angka resmi klub; “Gaji / tahun” sudah termasuk bonus. Kontrak dan nilai pasar dari {src}. Tanda “–”
            berarti sumber tidak punya datanya.
            {sal.error && ' Data gaji gagal dimuat saat ini.'}
          </span>
          {unmatched.length > 0 && (
            <span className="kp-legend-note">
              Ada di tabel gaji tetapi tidak ditemukan di skuad saat ini: {unmatched.map((s) => `${s.name}${STATUS[s.status ?? ''] ? ` (${STATUS[s.status ?? ''].toLowerCase()})` : ''}`).join(', ')}.
            </span>
          )}
        </footer>
      </section>

      {selected && <PlayerModal player={selected} stats={stats} source={src} onClose={closePlayer} />}
    </div>
  );
}
