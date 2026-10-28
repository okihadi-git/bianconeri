'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [liveVisible, setLiveVisible] = useState(false);
  const [liveBadge, setLiveBadge] = useState('OTOMATIS TERDETEKSI');
  const [matchStatus, setMatchStatus] = useState('SELESAI · SERIE A');
  const [autoNotice, setAutoNotice] = useState('Panel otomatis aktif selama rentang 48 jam sejak kick-off.');
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const targetMatchTime = new Date('2026-10-28T02:45:00+07:00');
    const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

    const interval = setInterval(() => {
      const now = new Date();
      const diffFromMatchStart = now.getTime() - targetMatchTime.getTime();
      const isMatchLiveOrRecent = diffFromMatchStart >= 0 && diffFromMatchStart <= FORTY_EIGHT_HOURS_MS;

      if (isMatchLiveOrRecent) {
        setLiveVisible(true);
        const hoursElapsed = Math.floor(diffFromMatchStart / (1000 * 60 * 60));
        if (diffFromMatchStart <= (2 * 60 * 60 * 1000)) {
          setLiveBadge('● LIVE SEKARANG');
          setMatchStatus('SEDANG BERLANGSUNG · SERIE A');
          setAutoNotice('Pertandingan sedang berlangsung. Panel otomatis aktif hingga 48 jam ke depan.');
        } else {
          setLiveBadge(`HASIL LAGA (${hoursElapsed}j LALU)`);
          setMatchStatus('SELESAI · HINGGA 2 HARI POST-MATCH');
          setAutoNotice(`Panel ini akan tetap tampil hingga 48 jam setelah kick-off (sisa ${48 - hoursElapsed} jam lagi).`);
        }
      } else {
        setLiveVisible(false);
      }

      const cdDiff = targetMatchTime.getTime() - now.getTime();
      if (cdDiff > 0) {
        setCountdown({
          days: Math.floor(cdDiff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((cdDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          mins: Math.floor((cdDiff % (1000 * 60 * 60)) / (1000 * 60)),
          secs: Math.floor((cdDiff % (1000 * 60)) / 1000),
        });
      } else {
        setCountdown({ days: 0, hours: 0, mins: 0, secs: 0 });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div id="beranda">
      {/* PANEL LIVE SCORE OTOMATIS TERDETEKSI */}
      {liveVisible && (
        <section className="panel live-panel">
          <div className="live-top">
            <span><strong>● PERTANDINGAN TERDETEKSI</strong> / MATCH CENTRE</span>
            <span className="badge-auto">{liveBadge}</span>
          </div>
          <div className="live-score">
            <div className="team-side home">
              <div className="team-monogram">JUV</div>
              <div><div className="team-title">Juventus</div><div className="team-caption">Tuan rumah</div></div>
            </div>
            <div>
              <div className="score-big">2 — 1</div>
              <div className="score-status">{matchStatus}</div>
            </div>
            <div className="team-side away">
              <div><div className="team-title">Inter</div><div class="team-caption">Tim tamu</div></div>
              <div className="team-monogram">INT</div>
            </div>
          </div>
          <div className="event-strip">
            <span>⚽ <b className="goal">Vlahović 34′</b></span>
            <span>⚽ <b className="goal">Yıldız 71′</b></span>
            <span>⚽ Thuram 58′</span>
            <span>🏟 Allianz Stadium</span>
          </div>
          <div className="live-controls">
            <span>{autoNotice}</span>
            <button className="ghost-btn">Detail pertandingan ↗</button>
          </div>
        </section>
      )}

      {/* PREVIEW MATCHDAY */}
      <section className="preview-card">
        <div className="preview-header">
          <div>
            <h2 className="preview-title">Preview: Juventus vs Inter</h2>
            <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Serie A Pekan 10 · Minggu, 1 Nov · 02.45 WIB · Allianz Stadium</span>
          </div>
          <button className="share-btn">Bagikan preview ↗</button>
        </div>
        <div className="preview-grid">
          <div className="preview-col">
            <h4>Lawan Utama</h4>
            <h3>Inter Milan</h3>
            <p>Asuhan Simone Inzaghi, peringkat 2 dengan 21 poin setelah menang 2-0 atas Roma.</p>
          </div>
          <div className="preview-col">
            <h4>Jalan Juventus</h4>
            <h3>Tren Positif Bianconeri</h3>
            <p>Menang 1-0 atas Lazio di laga terakhir liga lewat gol tunggal Yıldız.</p>
          </div>
          <div className="preview-col">
            <h4>Kabar Skuad Bianconeri</h4>
            <ul className="team-news-list">
              <li><strong>• Absen:</strong> Bremer (lutut), Milik (betis), Koopmeiners (rusuk).</li>
              <li><strong>• Skorsing:</strong> Tidak ada pemain utama yang terkena skorsing.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* DASHBOARD GRID */}
      <div className="dashboard-grid">
        <div className="left-stack">
          {/* COUNTDOWN MATCH */}
          <section className="next-match">
            <div className="next-head"><h2>Agenda berikutnya</h2><span>FIXTURE RADAR / 01</span></div>
            <div className="match-feature">
              <span className="comp-tag">SERIE A · PEKAN REGULER</span>
              <div className="feature-matchup">
                <div className="club"><div className="club-symbol">J</div><div className="club-name">Juventus</div></div>
                <div className="versus">VS</div>
                <div className="club"><div className="club-symbol">INT</div><div className="club-name">Inter</div></div>
              </div>
              <div className="match-meta">
                <span><strong>Minggu, 1 November 2026</strong><br />Kick-off 02.45 WIB · Allianz Stadium</span>
                <span className="calendar-link">Tambah ke kalender ↗</span>
              </div>
              <div className="countdown">
                <div className="time-box"><b>{countdown.days}</b><span>Hari</span></div>
                <div className="time-box"><b>{countdown.hours}</b><span>Jam</span></div>
                <div className="time-box"><b>{countdown.mins}</b><span>Menit</span></div>
                <div className="time-box"><b>{countdown.secs}</b><span>Detik</span></div>
              </div>
            </div>
          </section>

          {/* PREDIKSI SUSUNAN PEMAIN */}
          <section className="panel">
            <div className="section-head">
              <h2>Prediksi susunan pemain</h2>
              <small>vs Inter · 1 Nov 2026 · Formasi 3-5-2</small>
            </div>
            <div style={{ padding: '20px' }}>
              <div className="pitch-container">
                <div className="pitch-lines"></div>
                <div className="pitch-row">
                  <div className="player-node"><div className="player-avatar">9</div><span className="player-name">Vlahović</span></div>
                  <div className="player-node"><div className="player-avatar">10</div><span className="player-name">Yıldız</span></div>
                </div>
                <div className="pitch-row">
                  <div className="player-node"><div className="player-avatar">27</div><span className="player-name">Cambiaso</span></div>
                  <div className="player-node"><div className="player-avatar">5</div><span className="player-name">Locatelli</span></div>
                  <div className="player-node"><div className="player-avatar">19</div><span className="player-name">Thuram</span></div>
                  <div className="player-node"><div className="player-avatar">16</div><span className="player-name">McKennie</span></div>
                  <div className="player-node"><div className="player-avatar">22</div><span className="player-name">Weah</span></div>
                </div>
                <div className="pitch-row">
                  <div className="player-node"><div className="player-avatar">6</div><span className="player-name">Danilo</span></div>
                  <div className="player-node"><div className="player-avatar">4</div><span className="player-name">Gatti</span></div>
                  <div className="player-node"><div className="player-avatar">15</div><span className="player-name">Kalulu</span></div>
                </div>
                <div className="pitch-row">
                  <div className="player-node"><div className="player-avatar">29</div><span className="player-name">Di Gregorio</span></div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT STACK */}
        <div className="right-stack">
          <div className="sub-widget-grid">
            <section className="panel">
              <div className="section-head"><h2>Wasit laga</h2></div>
              <div style={{ padding: '15px', fontSize: '11px' }}>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>Davide Massa</strong>
                <span>Wasit senior Serie A dari seksi Imperia.</span>
              </div>
            </section>
            <section className="panel">
              <div className="section-head"><h2>Cuaca kick-off</h2></div>
              <div style={{ padding: '15px' }}>
                <div className="weather-box">
                  <div className="weather-icon">🌧️</div>
                  <div><strong style={{ fontSize: '16px', display: 'block' }}>12°C · Hujan Ringan</strong></div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* PANDUAN SIARAN */}
      <section className="broadcast-card" style={{ marginTop: '20px' }}>
        <div className="section-head" style={{ padding: '0 0 12px', borderBottom: '1px solid var(--line)', marginBottom: '15px' }}>
          <h2 className="preview-title">Nonton di mana</h2>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Hak siar resmi di Indonesia · Musim 2026/27</span>
        </div>
        <div className="broadcast-grid">
          <div className="broadcast-col">
            <h4>SERIE A & COPPA ITALIA</h4>
            <h3>Vidio + BeIN Sports</h3>
            <div className="price-list">
              <div className="price-row"><span>Platinum / Diamond Mobile</span><b>Rp39.000 / bln</b></div>
            </div>
          </div>
          <div className="broadcast-col">
            <h4>UEFA CHAMPIONS LEAGUE</h4>
            <h3>Vidio + SCTV / RCTI</h3>
            <div className="price-list">
              <div className="price-row"><span>SCTV / TV FTA</span><b>GRATIS (Laga Pilihan)</b></div>
            </div>
          </div>
          <div className="broadcast-col">
            <h4>AUDIO OFFICIAL</h4>
            <h3>Juventus Radio</h3>
            <div className="price-list">
              <div className="price-row"><span>App Resmi</span><b>GRATIS</b></div>
            </div>
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
