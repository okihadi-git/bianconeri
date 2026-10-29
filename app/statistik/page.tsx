'use client';

import { useState } from 'react';
import { CompSelect, JUVE_LOGO, ScorersCard, useFetch } from '@/components/kp';
import type { PlayerStat } from '@/lib/types';

const COMP_OPTIONS = [
  { value: 'all', label: 'Semua kompetisi' },
  { value: 'ita.1', label: 'Serie A' },
  { value: 'uefa.europa', label: 'Liga Europa' },
  { value: 'ita.coppa_italia', label: 'Coppa Italia' },
];

type StatsResponse = { players: PlayerStat[] };

export default function StatisticsPage() {
  const [league, setLeague] = useState('all');
  const statsUrl = `/api/juventus/stats${league !== 'all' ? `?league=${encodeURIComponent(league)}` : ''}`;
  const statsRes = useFetch<StatsResponse>(statsUrl);

  return (
    <main className="kp">
      <header className="kp-team-head">
        <img src={JUVE_LOGO} alt="" className="kp-team-logo" />
        <div>
          <h1 className="kp-team-name">Statistik Juventus</h1>
          <span className="kp-muted">Gol dan kartu · data pertandingan ESPN</span>
        </div>
      </header>

      <div className="kp-filter kp-filter-top">
        <CompSelect value={league} onChange={setLeague} options={COMP_OPTIONS} allLabel={null} />
      </div>
      <ScorersCard
        title="Gol & kartu"
        subtitle="Dihitung dari kejadian tiap pertandingan · assist dan jumlah main belum tersedia"
        players={statsRes.data?.players ?? []}
        loading={statsRes.loading}
        error={statsRes.error}
        cards
        limit={40}
      />
    </main>
  );
}
