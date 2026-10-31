'use client';

import { useMemo } from 'react';
import { useFetch } from '@/components/kp';
import { PlayerAvatar } from '@/components/team';
import type { SquadPlayer, SquadResponse } from '@/lib/types';

const jerseyNum = (p: SquadPlayer) => (p.jersey ? Number(p.jersey) : 999);

export default function TimnasPage() {
  const res = useFetch<SquadResponse>('/api/squad');
  const players = res.data?.players ?? [];

  const countries = useMemo(() => {
    const map = new Map<string, SquadPlayer[]>();
    for (const p of players) {
      const key = p.nation[0] || 'Kebangsaan tidak diketahui';
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()]
      .map(([nation, list]) => ({ nation, list: list.sort((a, b) => jerseyNum(a) - jerseyNum(b) || a.name.localeCompare(b.name)) }))
      .sort((a, b) => b.list.length - a.list.length || a.nation.localeCompare(b.nation));
  }, [players]);

  const dual = players.filter((p) => p.nation.length > 1).length;
  const top = countries[0];

  return (
    <div className="kp" id="timnas">
      <div className="kp-metrics">
        <div className="kp-metric kp-metric-red">
          <div className="kp-metric-label">Negara asal pemain</div>
          <div className="kp-metric-val">{players.length ? countries.length : '–'}</div>
          <div className="kp-metric-sub">{players.length ? `dari ${players.length} pemain tim utama` : res.loading ? 'Memuat data…' : 'Belum ada data'}</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Terbanyak</div>
          <div className="kp-metric-val sq-coach">{top?.nation ?? '–'}</div>
          <div className="kp-metric-sub">{top ? `${top.list.length} pemain` : ' '}</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Berkewarganegaraan ganda</div>
          <div className="kp-metric-val">{players.length ? dual : '–'}</div>
          <div className="kp-metric-sub">Tercatat lebih dari satu negara di sumber data</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Sumber</div>
          <div className="kp-metric-val sq-coach">{res.data ? (res.data.source === 'fotmob' ? 'FotMob' : 'Transfermarkt') : '–'}</div>
          <div className="kp-metric-sub">Kebangsaan pemain, bukan daftar panggilan</div>
        </div>
      </div>

      <section className="kp-card">
        <header className="kp-card-head">
          <h2 className="kp-title">Pemain per negara</h2>
          <small className="kp-muted">Berdasarkan kebangsaan utama</small>
        </header>

        {res.loading ? (
          <div className="kp-empty">Memuat data pemain…</div>
        ) : res.error || !players.length ? (
          <div className="kp-empty">
            Data pemain belum bisa dimuat dari Transfermarkt maupun FotMob. Coba muat ulang beberapa saat lagi.
          </div>
        ) : (
          countries.map((c) => (
            <div key={c.nation}>
              <div className="kp-group">
                {c.nation} · {c.list.length}
              </div>
              <div className="sq-grid">
                {c.list.map((p) => (
                  <div className="sq-player" key={p.id}>
                    <PlayerAvatar p={p} />
                    <div className="sq-info">
                      <div className="sq-name">
                        <b>{p.name}</b>
                      </div>
                      <div className="kp-muted sq-meta">
                        {[p.position, p.age != null ? `${p.age} th` : '', p.nation.length > 1 ? `juga: ${p.nation.slice(1).join(' / ')}` : ''].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <footer className="kp-legend">
          <span className="kp-legend-note">
            Daftar ini mengelompokkan pemain menurut kebangsaan yang tercatat di sumber data. Panggilan timnas, caps, dan jadwal laga internasional tidak tersedia dari sumber yang dipakai, jadi tidak ditampilkan.
          </span>
        </footer>
      </section>
    </div>
  );
}
