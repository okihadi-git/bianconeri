'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFetch } from '@/components/kp';
import PlayerModal from '@/components/PlayerModal';
import { fmtEuro, PlayerAvatar } from '@/components/team';
import { findPlayer } from '@/lib/names';
import { positionId, seasonsLeft } from '@/lib/playerprofile';
import type { PlayerRow, PlayerStatsResponse } from '@/lib/playerstats';
import { salaryFrom, weeklyOf, yearlyOf, type Salary, type SalaryResponse } from '@/lib/salaries';
import type { SquadPlayer, SquadResponse } from '@/lib/types';
import './kontrak.css';

/* ---------- status kontrak ---------- */

type Tone = 'red' | 'orange' | 'yellow' | 'green' | 'gray';
interface Status {
  tone: Tone;
  label: string;
}

/** Nilai pasar minimal (euro) agar pemain dengan sisa kontrak ≤ 2 musim dianggap "prioritas perpanjangan". */
const PRIORITY_VALUE = 40_000_000;

/**
 * Status dihitung otomatis dari data, dengan aturan sederhana (urutan = prioritas). Ini bukan sikap resmi klub.
 *  Pinjaman                → tercatat LOAN di tabel gaji
 *  Harus diputuskan        → sisa kontrak 1 musim
 *  Pertimbangkan kontrak pendek → usia 30+ dan sisa ≤ 2 musim
 *  Prioritas perpanjangan  → sisa ≤ 2 musim dan nilai pasar ≥ €40 jt
 *  Mulai dibicarakan       → sisa ≤ 2 musim lainnya
 *  Aman                    → sisa ≥ 3 musim
 */
export function statusOf(p: SquadPlayer, s: Salary | null, left: number): Status | null {
  if (s?.status === 'LOAN') return { tone: 'gray', label: 'Pinjaman' };
  if (left <= 0) return null; // tanggal kontrak tidak diketahui
  if (left === 1) return { tone: 'red', label: 'Harus diputuskan' };
  if ((p.age ?? 0) >= 30 && left <= 2) return { tone: 'orange', label: 'Pertimbangkan kontrak pendek' };
  if (left <= 2 && (p.marketValue ?? 0) >= PRIORITY_VALUE) return { tone: 'red', label: 'Prioritas perpanjangan' };
  if (left <= 2) return { tone: 'yellow', label: 'Mulai dibicarakan' };
  return { tone: 'green', label: 'Aman' };
}

const LEGEND: { tone: Tone; label: string }[] = [
  { tone: 'red', label: 'harus diputuskan / prioritas' },
  { tone: 'orange', label: 'usia 30+' },
  { tone: 'yellow', label: 'mulai dibicarakan' },
  { tone: 'green', label: 'aman' },
  { tone: 'gray', label: 'pinjaman' },
];

/* ---------- util ---------- */

interface Row {
  p: SquadPlayer;
  s: Salary | null;
  weekly: number | null;
  yearly: number | null;
  until: string | null;
  left: number;
  status: Status | null;
  goals: number;
  assists: number;
  minutes: number;
  hasStats: boolean;
}

const money = (n: number | null) => (n == null ? '–' : fmtEuro(Math.round(n / 1000) * 1000));
/** Angka kecil (mis. €2 per kontribusi) tetap tampil, tidak dibulatkan ke ribuan. */
const small = (n: number) => (n >= 1_000_000 ? fmtEuro(n) : n >= 1000 ? `€${Math.round(n / 1000)} rb` : `€${Math.round(n)}`);

/** "Randal Kolo Muani" → "Kolo Muani", "Gleison Bremer" → "Bremer" */
const shortName = (full: string) => {
  const t = full.trim().split(/\s+/);
  return t.length < 2 ? full : t.slice(1).join(' ');
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const expiryYear = (iso: string) => {
  const d = new Date(iso);
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
};

const niceMax = (v: number, step: number) => Math.max(step, Math.ceil(v / step) * step);

type SortKey = 'name' | 'age' | 'weekly' | 'yearly' | 'until' | 'value';
type Filter = 'all' | 'Kiper' | 'Bek' | 'Gelandang' | 'Penyerang' | 'loan';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'Kiper', label: 'Kiper' },
  { key: 'Bek', label: 'Bek' },
  { key: 'Gelandang', label: 'Gelandang' },
  { key: 'Penyerang', label: 'Penyerang' },
  { key: 'loan', label: 'Pinjaman' },
];

/* ---------- grafik: gaji vs nilai pasar ---------- */

function Scatter({ rows, onPick }: { rows: Row[]; onPick: (p: SquadPlayer) => void }) {
  const pts = rows.filter((r) => r.weekly != null && r.p.marketValue != null);
  if (pts.length < 3) return <div className="kp-empty">Data gaji dan nilai pasar belum cukup untuk membuat grafik.</div>;

  const W = 640;
  const H = 340;
  const L = 58;
  const R = 22;
  const T = 16;
  const B = 44;
  const xMax = niceMax(Math.max(...pts.map((r) => r.weekly as number)), 25_000);
  const yMax = niceMax(Math.max(...pts.map((r) => r.p.marketValue as number)), 20_000_000);
  const x = (v: number) => L + (v / xMax) * (W - L - R);
  const y = (v: number) => H - B - (v / yMax) * (H - T - B);

  // Garis acuan: rasio nilai pasar terhadap gaji seluruh skuad. Di atas garis = nilai pasar tinggi untuk gajinya.
  const ratio = pts.reduce((n, r) => n + (r.p.marketValue as number), 0) / pts.reduce((n, r) => n + (r.weekly as number), 0);
  const lineX = Math.min(xMax, yMax / ratio);
  const ticks = [0, 1, 2, 3, 4];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ko-scatter" role="img" aria-label="Gaji per pekan terhadap nilai pasar">
      <text x={L - 8} y={10} className="ko-axis" textAnchor="end">nilai pasar</text>
      {ticks.map((i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y((yMax / 4) * i)} y2={y((yMax / 4) * i)} className="ko-grid" />
          <text x={L - 8} y={y((yMax / 4) * i) + 3} textAnchor="end" className="ko-axis">{i ? fmtEuro((yMax / 4) * i) : '0'}</text>
          <text x={x((xMax / 4) * i)} y={H - B + 16} textAnchor="middle" className="ko-axis">{i ? fmtEuro((xMax / 4) * i) : '€0'}</text>
        </g>
      ))}
      <text x={W - R} y={H - 6} textAnchor="end" className="ko-axis">gaji per pekan →</text>
      <line x1={x(0)} y1={y(0)} x2={x(lineX)} y2={y(lineX * ratio)} className="ko-trend" />
      {pts.map((r) => (
        <g key={r.p.id} className="ko-dot" onClick={() => onPick(r.p)}>
          <circle cx={x(r.weekly as number)} cy={y(r.p.marketValue as number)} r={6} className={`ko-fill-${r.status?.tone ?? 'gray'}`}>
            <title>{`${r.p.name} · gaji ${money(r.weekly)}/pekan · nilai ${fmtEuro(r.p.marketValue)}${r.status ? ` · ${r.status.label}` : ''}`}</title>
          </circle>
          <text x={x(r.weekly as number) + 9} y={y(r.p.marketValue as number) + 3} className="ko-lbl">{shortName(r.p.name)}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- halaman ---------- */

export default function KontrakPage() {
  const squad = useFetch<SquadResponse>('/api/squad');
  const sal = useFetch<SalaryResponse>('/api/gaji');
  const stats = useFetch<PlayerStatsResponse>('/api/juventus/stats');
  const [selected, setSelected] = useState<SquadPlayer | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'weekly', dir: -1 });
  const closePlayer = useCallback(() => setSelected(null), []);

  const now = useMemo(() => new Date(), []);
  const players = squad.data?.players ?? [];
  const salaries = sal.data?.salaries ?? [];
  const src = squad.data?.source === 'fotmob' ? 'FotMob' : 'Transfermarkt';
  const endY = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear(); // tahun akhir musim berjalan

  // Gaji "sejak 1 Agustus": jumlah pekan sejak awal musim ini
  const weeks = useMemo(() => {
    const y = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    return Math.max(1, (now.getTime() - Date.UTC(y, 7, 1)) / (7 * 86_400_000));
  }, [now]);

  const rows: Row[] = useMemo(
    () =>
      players.map((p) => {
        const s = salaryFrom(salaries, { name: p.name, ids: squad.data?.source === 'fotmob' ? { fotmob: p.id } : { tm: p.id } });
        const until = p.contractUntil ?? s?.expiration ?? null;
        const left = seasonsLeft(until, now);
        const sr = stats.data ? (findPlayer(p.name, stats.data.players) as PlayerRow | null) : null;
        const lines = sr ? Object.values(sr.by) : [];
        return {
          p,
          s,
          weekly: s ? weeklyOf(s) : null,
          yearly: s ? yearlyOf(s) : null,
          until,
          left,
          status: statusOf(p, s, left),
          goals: lines.reduce((n, l) => n + l.goals, 0),
          assists: lines.reduce((n, l) => n + (l.assists ?? 0), 0),
          minutes: lines.reduce((n, l) => n + l.minutes, 0),
          hasStats: Boolean(sr),
        };
      }),
    [players, salaries, squad.data?.source, stats.data, now]
  );

  /* ringkasan */
  const withWeekly = rows.filter((r) => r.weekly != null);
  const totalWeekly = withWeekly.reduce((n, r) => n + (r.weekly ?? 0), 0);
  const totalYearly = rows.reduce((n, r) => n + (r.yearly ?? 0), 0);
  const medianWeekly = median(withWeekly.map((r) => r.weekly as number));
  const totalValue = rows.reduce((n, r) => n + (r.p.marketValue ?? 0), 0);
  const thisSeason = rows.filter((r) => r.left === 1 && r.s?.status !== 'LOAN').length;
  const throughNext = rows.filter((r) => r.left >= 1 && r.left <= 2 && r.s?.status !== 'LOAN').length;

  /* kolom "kapan kontrak habis" */
  const years = Array.from({ length: 6 }, (_, i) => endY + i);
  const byYear = years.map((yr, i) => {
    const list = rows
      .filter((r) => r.until && r.left >= 1 && (i === 5 ? expiryYear(r.until) >= yr : expiryYear(r.until) === yr))
      .sort((a, b) => (b.p.marketValue ?? -1) - (a.p.marketValue ?? -1));
    return { yr, list, label: i === 5 ? `${yr}+` : String(yr) };
  });

  /* kontribusi musim ini */
  const efficiency = rows
    .filter((r) => r.weekly != null && r.goals + r.assists > 0)
    .map((r) => ({ r, cost: ((r.weekly as number) * weeks) / (r.goals + r.assists) }))
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 6);
  const perMinute = rows
    .filter((r) => r.weekly != null && r.minutes > 0)
    .map((r) => ({ r, cost: ((r.weekly as number) * weeks) / r.minutes }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 6);

  /* tabel */
  const shown = useMemo(() => {
    const list = rows.filter((r) => (filter === 'all' ? true : filter === 'loan' ? r.s?.status === 'LOAN' : r.p.group === filter));
    const val = (r: Row): number | string | null =>
      sort.key === 'name' ? r.p.name : sort.key === 'age' ? r.p.age : sort.key === 'weekly' ? r.weekly : sort.key === 'yearly' ? r.yearly : sort.key === 'until' ? r.until : r.p.marketValue;
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null && y == null) return a.p.name.localeCompare(b.p.name);
      if (x == null) return 1; // data kosong selalu di bawah
      if (y == null) return -1;
      const c = typeof x === 'string' ? x.localeCompare(String(y)) : x - (y as number);
      return c * sort.dir || a.p.name.localeCompare(b.p.name);
    });
  }, [rows, filter, sort]);

  const setSortKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' || key === 'until' ? 1 : -1 }));
  const th = (key: SortKey, label: string, className?: string) => (
    <th className={className}>
      <button type="button" className={`ko-th${sort.key === key ? ' active' : ''}`} onClick={() => setSortKey(key)} aria-label={`Urutkan berdasarkan ${label}`}>
        {label}
        {sort.key === key && <span aria-hidden>{sort.dir === -1 ? ' ↓' : ' ↑'}</span>}
      </button>
    </th>
  );

  const unmatched = salaries.filter((s) => !rows.some((r) => r.s === s));
  const loading = squad.loading || sal.loading;
  const noSquad = !squad.loading && (squad.error || !players.length);
  const open = (p: SquadPlayer) => setSelected(p);

  return (
    <div className="kp" id="kontrak">
      <div className="kp-metrics">
        <div className="kp-metric kp-metric-red">
          <div className="kp-metric-label">Total gaji skuad</div>
          <div className="kp-metric-val">{withWeekly.length ? fmtEuro(Math.round(totalWeekly / 1000) * 1000) : '–'}</div>
          <div className="kp-metric-sub">
            {withWeekly.length ? `per pekan · ±${fmtEuro(Math.round(totalYearly / 10_000) * 10_000)} per tahun (termasuk bonus, perkiraan)` : loading ? 'Memuat data…' : 'Data gaji belum tersedia'}
          </div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Median gaji</div>
          <div className="kp-metric-val">{medianWeekly != null ? money(medianWeekly) : '–'}</div>
          <div className="kp-metric-sub">per pekan · {withWeekly.length} pemain dengan data</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Nilai pasar skuad</div>
          <div className="kp-metric-val">{totalValue ? fmtEuro(Math.round(totalValue / 1_000_000) * 1_000_000) : '–'}</div>
          <div className="kp-metric-sub">estimasi {src}</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Kontrak habis</div>
          <div className="kp-metric-val">
            {players.length ? thisSeason : '–'}
            {players.length > 0 && <small className="ko-of"> / {throughNext}</small>}
          </div>
          <div className="kp-metric-sub">
            Juni {endY} / sampai Juni {endY + 1}
          </div>
        </div>
      </div>

      {noSquad ? (
        <section className="kp-card">
          <div className="kp-empty">Skuad belum bisa dimuat dari Transfermarkt maupun FotMob. Coba muat ulang beberapa saat lagi.</div>
        </section>
      ) : (
        <>
          <section className="kp-card ko-card">
            <header className="kp-card-head">
              <h2 className="kp-title">Kapan kontrak habis</h2>
              <small className="kp-muted">Kontrak berakhir 30 Juni tiap tahun · warna = status</small>
            </header>
            <div className="ko-years">
              {byYear.map((c, i) => (
                <div key={c.yr} className={`ko-year${i < 2 ? ' urgent' : ''}`}>
                  <div className="ko-year-head">
                    <b>{c.label}</b>
                    <span>{c.list.length} pemain</span>
                  </div>
                  {c.list.length === 0 ? (
                    <div className="ko-none">–</div>
                  ) : (
                    c.list.map((r) => (
                      <button key={r.p.id} type="button" className={`ko-chip ko-tone-${r.status?.tone ?? 'gray'}`} onClick={() => open(r.p)} aria-label={`Lihat profil ${r.p.name}`}>
                        <b>{shortName(r.p.name)}</b>
                        <small>{[r.p.age != null ? `${r.p.age} th` : '', r.p.marketValue != null ? fmtEuro(r.p.marketValue) : ''].filter(Boolean).join(' · ')}</small>
                      </button>
                    ))
                  )}
                </div>
              ))}
            </div>
            <div className="ko-legend">
              {LEGEND.map((l) => (
                <span key={l.tone}>
                  <i className={`ko-fill-${l.tone}`} /> {l.label}
                </span>
              ))}
            </div>
          </section>

          <div className="ko-split">
            <section className="kp-card ko-card">
              <header className="kp-card-head">
                <h2 className="kp-title">Gaji vs nilai pasar</h2>
                <small className="kp-muted">Di atas garis = nilai pasar tinggi untuk gajinya</small>
              </header>
              <div className="ko-pad">
                <Scatter rows={rows} onPick={open} />
              </div>
            </section>

            <section className="kp-card ko-card">
              <header className="kp-card-head ko-stack">
                <h2 className="kp-title">Gaji vs kontribusi musim ini</h2>
                <small className="kp-muted">Semua kompetisi · gaji tetap dihitung sejak 1 Agustus</small>
              </header>
              {stats.loading ? (
                <div className="kp-empty">Memuat statistik…</div>
              ) : !stats.data ? (
                <div className="kp-empty">Statistik pemain belum bisa dimuat dari ESPN.</div>
              ) : !efficiency.length && !perMinute.length ? (
                <div className="kp-empty">Belum ada pemain dengan data gaji dan statistik sekaligus.</div>
              ) : (
                <div className="ko-pad">
                  <h3 className="ko-sub">Paling efisien (gaji per gol + assist)</h3>
                  <ul className="ko-list">
                    {efficiency.map(({ r, cost }) => (
                      <li key={r.p.id}>
                        <button type="button" onClick={() => open(r.p)}>
                          <b>{r.p.name}</b>
                          <span>{r.goals}G {r.assists}A</span>
                          <em>{small(cost)}</em>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <h3 className="ko-sub">Gaji termahal per menit bermain</h3>
                  <ul className="ko-list">
                    {perMinute.map(({ r, cost }) => (
                      <li key={r.p.id}>
                        <button type="button" onClick={() => open(r.p)}>
                          <b>{r.p.name}</b>
                          <span>{r.minutes}&apos;</span>
                          <em>{small(cost)}/menit</em>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          <section className="kp-card ko-card">
            <header className="kp-card-head">
              <h2 className="kp-title">Daftar kontrak</h2>
              <small className="kp-muted">Klik pemain untuk profil lengkap</small>
            </header>
            <div className="sq-toolbar">
              <div className="sq-chips">
                {FILTERS.map((f) => (
                  <button key={f.key} className={`sq-chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {squad.loading ? (
              <div className="kp-empty">Memuat skuad…</div>
            ) : (
              <div className="kp-table-wrap">
                <table className="kp-table ko-table">
                  <thead>
                    <tr>
                      {th('name', 'Pemain', 'ko-left')}
                      {th('age', 'Umur')}
                      {th('weekly', 'Gaji/pekan')}
                      {th('yearly', 'Gaji/tahun')}
                      {th('until', 'Kontrak s/d')}
                      {th('value', 'Nilai')}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.p.id}>
                        <td className="ko-left">
                          <button type="button" className="kt-player" onClick={() => open(r.p)} aria-haspopup="dialog" aria-label={`Lihat profil ${r.p.name}`}>
                            <PlayerAvatar p={r.p} />
                            <span>
                              <b>{r.p.name}</b>
                              <small className="kp-muted">{positionId(r.p.position)}</small>
                            </span>
                          </button>
                        </td>
                        <td>{r.p.age ?? '–'}</td>
                        <td>{money(r.weekly)}</td>
                        <td>{money(r.yearly)}</td>
                        <td>
                          {r.until ? (
                            <>
                              <b>{expiryYear(r.until)}</b>
                              {r.left > 0 && <small className="ko-left-seasons">({r.left} musim)</small>}
                            </>
                          ) : (
                            '–'
                          )}
                        </td>
                        <td>{fmtEuro(r.p.marketValue)}</td>
                        <td>{r.status ? <span className={`ko-st ko-st-${r.status.tone}`}>{r.status.label}</span> : '–'}</td>
                      </tr>
                    ))}
                    {!shown.length && (
                      <tr>
                        <td colSpan={7} className="kp-empty">
                          Tidak ada pemain di kategori ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="kp-legend ko-foot">
            <span className="kp-legend-note">
              Gaji kotor (sebelum pajak) adalah estimasi {salaries[0]?.source || 'pihak ketiga'} dari database proyek ini, bukan angka resmi klub. “Gaji/pekan” = gaji tetap; “Gaji/tahun” sudah termasuk bonus. Kontrak
              dan nilai pasar dari {src}; gol, assist, dan menit dari ESPN. Tanda “–” berarti sumber tidak punya datanya.
              {sal.error && ' Data gaji gagal dimuat saat ini.'}
            </span>
            <span className="kp-legend-note">
              Status dihitung otomatis dengan aturan sederhana, bukan sikap resmi klub: <b>Harus diputuskan</b> = sisa kontrak 1 musim · <b>Pertimbangkan kontrak pendek</b> = usia 30+ dan sisa ≤ 2 musim ·{' '}
              <b>Prioritas perpanjangan</b> = sisa ≤ 2 musim dan nilai pasar ≥ {fmtEuro(PRIORITY_VALUE)} · <b>Mulai dibicarakan</b> = sisa ≤ 2 musim lainnya · <b>Aman</b> = sisa ≥ 3 musim · <b>Pinjaman</b> = tercatat
              LOAN di tabel gaji.
            </span>
            {unmatched.length > 0 && (
              <span className="kp-legend-note">
                Ada di tabel gaji tetapi tidak ditemukan di skuad saat ini: {unmatched.map((s) => s.name).join(', ')}.
              </span>
            )}
          </footer>
        </>
      )}

      {selected && <PlayerModal player={selected} stats={stats} source={src} onClose={closePlayer} />}
    </div>
  );
}
