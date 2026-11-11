'use client';

import LiveScore from '@/components/LiveScore';
import { CombinedCalendar, LeagueCards, NextMatchCard } from '@/components/HomeWidgets';
import { useFetch } from '@/components/kp';
import type { Match, Team } from '@/lib/types';

export default function Home() {
  // Data diambil sekali di sini lalu dibagikan ke semua widget beranda
  const juveRes = useFetch<{ upcoming: Match[]; past: Match[] }>('/api/juventus');
  const serieARes = useFetch<{ standings: Team[] }>('/api/standings?league=ita.1');
  const europaRes = useFetch<{ standings: Team[] }>('/api/standings?league=uefa.europa');

  const upcoming = juveRes.data?.upcoming ?? [];
  const past = juveRes.data?.past ?? [];
  // Laga yang sedang berlangsung ditampilkan di panel Skor live, bukan sebagai "berikutnya"
  const scheduled = upcoming.filter((m) => m.status !== 'live');
  const next = scheduled[0] ?? null;

  return (
    <div className="kp" id="beranda">
      <LiveScore next={next} />

      <LeagueCards
        serieA={serieARes.data?.standings ?? []}
        europa={europaRes.data?.standings ?? []}
        past={past}
        upcoming={upcoming}
        loading={juveRes.loading || serieARes.loading || europaRes.loading}
      />

      <div className="hm-grid">
        <NextMatchCard next={next} loading={juveRes.loading} />
        <CombinedCalendar upcoming={scheduled} loading={juveRes.loading} error={juveRes.error} />
      </div>

      <section className="kp-card hm-bc">
        <header className="kp-card-head">
          <h2 className="kp-title">Nonton di mana</h2>
          <small className="kp-muted">Hak siar resmi di Indonesia · Musim 2026/27</small>
        </header>
        <div className="hm-bc-grid">
          <div className="hm-bc-col">
            <h4>SERIE A & COPPA ITALIA</h4>
            <h3>Vidio + BeIN Sports</h3>
            <div className="hm-bc-row"><span>Platinum / Diamond Mobile</span><b>Rp39.000 / bln</b></div>
          </div>
          <div className="hm-bc-col">
            <h4>UEFA CHAMPIONS LEAGUE</h4>
            <h3>Vidio + SCTV / RCTI</h3>
            <div className="hm-bc-row"><span>SCTV / TV FTA</span><b>GRATIS (Laga Pilihan)</b></div>
          </div>
          <div className="hm-bc-col">
            <h4>AUDIO OFFICIAL</h4>
            <h3>Juventus Radio</h3>
            <div className="hm-bc-row"><span>App Resmi</span><b>GRATIS</b></div>
          </div>
        </div>
      </section>

      <div className="footer">
        <span>BIANCONERI · Juventus Club Hub</span>
        <span>Pembaruan otomatis real-time via Date JS.</span>
      </div>
    </div>
  );
}
