'use client';

import { useState } from 'react';

export default function KompetisiPage() {
  const [activeTab, setActiveTab] = useState<'klasemen' | 'lagalain' | 'topskor'>('klasemen');

  return (
    <div>
      {/* Navigasi Bar Kompetisi */}
      <div className="comp-nav">
        <button className="comp-btn active">🇮🇹 Serie A</button>
        <button className="comp-btn">🇪🇺 Liga Champions</button>
        <button class="comp-btn">🏆 Coppa Italia</button>
        <button className="comp-btn disabled">🛡️ Supercoppa <span className="badge-off">Tidak Ikut</span></button>
      </div>

      {/* Metrics Bar */}
      <div className="top-metrics">
        <div className="metric-card purple-bg">
          <div className="metric-label">Posisi Sekarang</div>
          <div className="metric-val">#3</div>
          <div className="metric-sub">Selisih 2 poin dari puncak (Inter)</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Poin</div>
          <div className="metric-val">17</div>
          <div className="metric-sub">5 Menang · 2 Seri · 1 Kalah</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Gol (M - K)</div>
          <div className="metric-val">11 - 4</div>
          <div className="metric-sub">Selisih Gol: +7</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Form 5 Laga Terakhir</div>
          <div className="form-badges">
            <span className="badge-f bg-s">S</span>
            <span className="badge-f bg-m">M</span>
            <span className="badge-f bg-m">M</span>
            <span className="badge-f bg-s">S</span>
            <span className="badge-f bg-m">M</span>
          </div>
        </div>
      </div>

      {/* Sub Nav Tabs */}
      <div className="sub-tabs">
        <button className={`tab-btn ${activeTab === 'klasemen' ? 'active' : ''}`} onClick={() => setActiveTab('klasemen')}>Klasemen & Jadwal</button>
        <button className={`tab-btn ${activeTab === 'lagalain' ? 'active' : ''}`} onClick={() => setActiveTab('lagalain')}>Intip Laga Lain</button>
        <button className={`tab-btn ${activeTab === 'topskor' ? 'active' : ''}`} onClick={() => setActiveTab('topskor')}>Top Skor & Assist</button>
      </div>

      {/* Sub Tab 1: Klasemen */}
      {activeTab === 'klasemen' && (
        <div className="grid-main">
          <div className="panel">
            <div className="sec-head"><h2 className="sec-title">Klasemen Serie A</h2><small>Pekan 8 dari 38</small></div>
            <table className="standings">
              <thead>
                <tr><th>#</th><th>KLUB</th><th>MN</th><th>M</th><th>S</th><th>K</th><th>SG</th><th>POIN</th></tr>
              </thead>
              <tbody>
                <tr><td>1</td><td><div className="club-cell"><span className="mini-logo">INT</span> Inter Milan</div></td><td>8</td><td>6</td><td>1</td><td>1</td><td>+12</td><td><strong>19</strong></td></tr>
                <tr><td>2</td><td><div className="club-cell"><span class="mini-logo">NAP</span> Napoli</div></td><td>8</td><td>6</td><td>0</td><td>2</td><td>+8</td><td><strong>18</strong></td></tr>
                <tr className="juve-row"><td>3</td><td><div className="club-cell"><span className="mini-logo" style={{ background: '#111', color: '#fff' }}>J</span> <strong>Juventus</strong></div></td><td>8</td><td>5</td><td>2</td><td>1</td><td>+7</td><td><strong>17</strong></td></tr>
                <tr><td>4</td><td><div className="club-cell"><span className="mini-logo">MIL</span> AC Milan</div></td><td>8</td><td>4</td><td>2</td><td>2</td><td>+5</td><td><strong>14</strong></td></tr>
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="sec-head"><h2 className="sec-title">Jadwal Juventus</h2><small>Mendatang</small></div>
            <div style={{ padding: '16px' }}>
              <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '9px', color: 'var(--red)', fontWeight: '900' }}>PEKAN 9 · TANDANG</span>
                <div style={{ fontWeight: '800', fontSize: '13px', margin: '3px 0' }}>Inter Milan vs Juventus</div>
                <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Minggu, 1 Nov 2026 · 02.45 WIB (Vidio)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab 2: Laga Lain */}
      {activeTab === 'lagalain' && (
        <div className="panel">
          <div className="sec-head"><h2 className="sec-title">Intip Laga Pesaing</h2></div>
          <div className="matches-grid">
            <div className="match-card">
              <div className="match-top"><span>SERIE A · PEKAN 8</span><span className="tag-pesaing">PESAING</span></div>
              <div className="match-main"><span>AS Roma</span> <span>1 — 1</span> <span>Inter Milan</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab 3: Top Skor */}
      {activeTab === 'topskor' && (
        <div className="panel">
          <div className="sec-head"><h2 className="sec-title">Top Skor Serie A</h2></div>
          <div className="stats-dual">
            <div>
              <h4 style={{ margin: '0 0 10px', color: 'var(--muted)' }}>⚽ TOP SKOR</h4>
              <div className="stat-list-item"><span>1. Mateo Retegui (Atalanta)</span><strong>8 Gol</strong></div>
              <div className="stat-list-item juve-player"><span>2. <strong>Dušan Vlahović (Juventus)</strong></span><strong>6 Gol</strong></div>
            </div>
            <div>
              <h4 style={{ margin: '0 0 10px', color: 'var(--muted)' }}>🅰️ TOP ASSIST</h4>
              <div className="stat-list-item juve-player"><span>1. <strong>Kenan Yıldız (Juventus)</strong></span><strong>4 Assist</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
