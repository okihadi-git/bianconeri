'use client';

import { useMemo, useState } from 'react';
import { useFetch } from '@/components/kp';
import type { SquadGroup, SquadPlayer, SquadResponse } from '@/lib/types';

const GROUPS: SquadGroup[] = ['Kiper', 'Bek', 'Gelandang', 'Penyerang', 'Lainnya'];
type Filter = 'Semua' | SquadGroup;
type SortKey = 'pos' | 'value' | 'age' | 'contract';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'pos', label: 'Posisi & nomor' },
  { key: 'value', label: 'Nilai pasar tertinggi' },
  { key: 'age', label: 'Usia (muda → tua)' },
  { key: 'contract', label: 'Kontrak berakhir lebih dulu' },
];

/** €12,5 jt / €800 rb */
function fmtEuro(n: number | null) {
  if (n == null) return '–';
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace('.', ',')} jt`;
  return `€${Math.round(n / 1000)} rb`;
}

function fmtContract(iso: string | null) {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
}

const jerseyNum = (p: SquadPlayer) => (p.jersey ? Number(p.jersey) : 999);

function PlayerCard({ p }: { p: SquadPlayer }) {
  const [broken, setBroken] = useState(false);
  const showPhoto = Boolean(p.photo) && !broken;
  return (
    <div className="sq-player">
      {showPhoto ? (
        <img src={p.photo} alt="" className="sq-photo" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <span className="kp-jersey">{p.jersey || '–'}</span>
      )}
      <div className="sq-info">
        <div className="sq-name">
          {showPhoto && p.jersey && <span className="sq-num">{p.jersey}</span>}
          <b>{p.name}</b>
          {p.captain && <span className="sq-cap" title="Kapten">C</span>}
        </div>
        <div className="kp-muted sq-meta">
          {[p.position, p.age != null ? `${p.age} th` : '', p.nation.join(' / ')].filter(Boolean).join(' · ')}
        </div>
        <div className="sq-stats">
          <span>
            Nilai <b>{fmtEuro(p.marketValue)}</b>
          </span>
          {p.contractUntil && (
            <span>
              Kontrak <b>{fmtContract(p.contractUntil)}</b>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SkuadPage() {
  const res = useFetch<SquadResponse>('/api/squad');
  const [filter, setFilter] = useState<Filter>('Semua');
  const [sort, setSort] = useState<SortKey>('pos');

  const players = res.data?.players ?? [];

  const summary = useMemo(() => {
    const ages = players.filter((p) => p.age != null);
    const valued = players.filter((p) => p.marketValue != null);
    const total = valued.reduce((n, p) => n + (p.marketValue ?? 0), 0);
    const top = valued.reduce<SquadPlayer | null>((best, p) => (!best || (p.marketValue ?? 0) > (best.marketValue ?? 0) ? p : best), null);
    const young = ages.reduce<SquadPlayer | null>((b, p) => (!b || (p.age ?? 0) < (b.age ?? 0) ? p : b), null);
    const old = ages.reduce<SquadPlayer | null>((b, p) => (!b || (p.age ?? 0) > (b.age ?? 0) ? p : b), null);
    return {
      count: (g: SquadGroup) => players.filter((p) => p.group === g).length,
      avgAge: ages.length ? ages.reduce((n, p) => n + (p.age ?? 0), 0) / ages.length : null,
      young,
      old,
      total,
      valuedCount: valued.length,
      top,
    };
  }, [players]);

  const sections = useMemo(() => {
    const base = filter === 'Semua' ? players : players.filter((p) => p.group === filter);
    if (sort === 'pos') {
      return GROUPS.map((g) => ({
        label: g,
        items: base.filter((p) => p.group === g).sort((a, b) => jerseyNum(a) - jerseyNum(b) || a.name.localeCompare(b.name)),
      })).filter((s) => s.items.length);
    }
    const sorted = [...base].sort((a, b) => {
      if (sort === 'value') return (b.marketValue ?? -1) - (a.marketValue ?? -1);
      if (sort === 'age') return (a.age ?? 999) - (b.age ?? 999);
      return (a.contractUntil ?? '9999').localeCompare(b.contractUntil ?? '9999');
    });
    return [{ label: SORTS.find((s) => s.key === sort)?.label ?? '', items: sorted }];
  }, [players, filter, sort]);

  const filters: Filter[] = ['Semua', ...GROUPS.filter((g) => players.some((p) => p.group === g))];
  const src = res.data?.source === 'fotmob' ? 'FotMob' : 'Transfermarkt';

  return (
    <div className="kp" id="skuad">
      <div className="kp-metrics">
        <div className="kp-metric kp-metric-purple">
          <div className="kp-metric-label">Pemain tim utama</div>
          <div className="kp-metric-val">{players.length || '–'}</div>
          <div className="kp-metric-sub">
            {players.length
              ? `${summary.count('Kiper')} kiper · ${summary.count('Bek')} bek · ${summary.count('Gelandang')} gelandang · ${summary.count('Penyerang')} penyerang`
              : res.loading
              ? 'Memuat data…'
              : 'Belum ada data'}
          </div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Rata-rata usia</div>
          <div className="kp-metric-val">{summary.avgAge != null ? summary.avgAge.toFixed(1).replace('.', ',') : '–'}</div>
          <div className="kp-metric-sub">
            {summary.young && summary.old ? `Termuda ${summary.young.name} (${summary.young.age}) · tertua ${summary.old.name} (${summary.old.age})` : '–'}
          </div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Total nilai pasar</div>
          <div className="kp-metric-val">{summary.valuedCount ? fmtEuro(summary.total) : '–'}</div>
          <div className="kp-metric-sub">
            {summary.top ? `Tertinggi ${summary.top.name} (${fmtEuro(summary.top.marketValue)})` : 'Tidak tersedia dari sumber data'}
          </div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Pelatih</div>
          <div className="kp-metric-val sq-coach">{res.data?.coach || '–'}</div>
          <div className="kp-metric-sub">{res.data ? `Data: ${src}` : ' '}</div>
        </div>
      </div>

      <section className="kp-card">
        <header className="kp-card-head">
          <h2 className="kp-title">Daftar skuad</h2>
          <small className="kp-muted">
            {res.data ? `Data ${src} · diperbarui ${new Date(res.data.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })}` : ''}
          </small>
        </header>

        {players.length > 0 && (
          <div className="sq-toolbar">
            <div className="sq-chips">
              {filters.map((f) => (
                <button key={f} className={`sq-chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
            <label className="kp-select-wrap">
              <span className="sr-only">Urutkan</span>
              <select className="kp-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {res.loading ? (
          <div className="kp-empty">Memuat skuad…</div>
        ) : res.error || !players.length ? (
          <div className="kp-empty">
            Skuad belum bisa dimuat dari Transfermarkt maupun FotMob. Sumber ini tidak resmi dan kadang memblokir permintaan dari server; coba muat ulang beberapa saat lagi.
          </div>
        ) : (
          sections.map((s) => (
            <div key={s.label}>
              <div className="kp-group">
                {s.label} · {s.items.length}
              </div>
              <div className="sq-grid">
                {s.items.map((p) => (
                  <PlayerCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          ))
        )}

        <footer className="kp-legend">
          <span className="kp-legend-note">
            Nilai pasar dan tanggal kontrak adalah estimasi Transfermarkt, bukan angka resmi klub. Gaji pemain tidak ditampilkan karena tidak disediakan sumber data.
          </span>
        </footer>
      </section>
    </div>
  );
}
