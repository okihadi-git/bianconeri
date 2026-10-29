'use client';

import { useMemo } from 'react';
import { JUVE_LOGO, useFetch } from '@/components/kp';
import type { Athlete } from '@/lib/types';

const GROUP_ORDER: Athlete['group'][] = ['Kiper', 'Bek', 'Gelandang', 'Penyerang', 'Lainnya'];

type SquadResponse = { players: Athlete[]; coach: string };

export default function SquadPage() {
  const squadRes = useFetch<SquadResponse>('/api/squad');
  const grouped = useMemo(() => {
    const players = squadRes.data?.players ?? [];
    return GROUP_ORDER.map((group) => ({ group, players: players.filter((p) => p.group === group) }))
      .filter((item) => item.players.length > 0);
  }, [squadRes.data]);

  return (
    <main className="kp">
      <header className="kp-team-head">
        <img src={JUVE_LOGO} alt="" className="kp-team-logo" />
        <div>
          <h1 className="kp-team-name">Skuad Juventus</h1>
          <span className="kp-muted">Pemain utama · data ESPN</span>
        </div>
      </header>

      <section className="kp-card" id="skuad">
        <header className="kp-card-head">
          <h2 className="kp-title">Daftar pemain</h2>
          <small className="kp-muted">{squadRes.data?.coach ? `Pelatih: ${squadRes.data.coach}` : 'Data ESPN'}</small>
        </header>
        {squadRes.loading ? (
          <div className="kp-empty">Memuat skuad…</div>
        ) : squadRes.error || !grouped.length ? (
          <div className="kp-empty">Skuad belum bisa dimuat dari ESPN. Coba muat ulang halaman.</div>
        ) : (
          grouped.map(({ group, players }) => (
            <div key={group}>
              <div className="kp-group">{group}</div>
              <div className="kp-squad">
                {players.map((player) => (
                  <div className="kp-player" key={player.id}>
                    <span className="kp-jersey">{player.jersey || '–'}</span>
                    <div>
                      <b>{player.name}</b>
                      <div className="kp-muted">
                        {[player.position, player.age ? `${player.age} th` : '', player.nation].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
