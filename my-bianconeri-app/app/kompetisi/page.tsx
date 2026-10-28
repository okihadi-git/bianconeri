'use client';

import { useState, useEffect } from 'react';

export default function KompetisiPage() {
  const [activeTab, setActiveTab] = useState<'klasemen' | 'lagalain' | 'topskor'>('klasemen');
  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStandings() {
      try {
        const res = await fetch('/api/standings');
        const data = await res.json();
        setStandings(data.standings || []);
      } catch (err) {
        console.error('Gagal memuat data klasemen:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStandings();
  }, []);

  const juveData = standings.find((item) => item.name.includes('Juventus'));
  const topTeam = standings[0];
  const pointsBehind = topTeam && juveData ? topTeam.points - juveData.points : 0;

  return (
    <div>
      {/* Navigasi Bar Kapsul */}
      <div className="comp-nav">
        <button className="comp-btn active">🇮🇹 Serie A</button>
        <button className="comp-btn">🇪🇺 Liga Champions</button>
        <button className="comp-btn">🏆 Coppa Italia</button>
        <button className="comp-btn disabled">
          🛡️ Supercoppa Italiana <span className="badge-off">Tidak Ikut</span>
        </button>
        <button className="comp-btn">✈️ Pramusim & Tur</button>
      </div>

      {/* Top Metrics Cards */}
      <div className="top-metrics">
        <div className="metric-card purple-bg">
          <div className="metric-label">Posisi</div>
          <div className="metric-val">#{juveData ? juveData.position : '-'}</div>
          <div className="metric-sub">
            {pointsBehind === 0
              ? 'Memimpin puncak klasemen'
              : `${pointsBehind} poin di belakang ${topTeam?.shortName || topTeam?.name || 'puncak'}`}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Poin</div>
          <div className="metric-val">{juveData ? juveData.points : '-'}</div>
          <div className="metric-sub">
            {juveData
              ? `${juveData.won}M · ${juveData.draw}S · ${juveData.lost}K dari ${juveData.playedGames} laga`
              : 'Memuat data...'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Gol</div>
          <div className="metric-val">
            {juveData ? `${juveData.goalsFor}-${juveData.goalsAgainst}` : '-'}
          </div>
          <div className="metric-sub">
            {juveData
              ? `Selisih ${juveData.goalDifference > 0 ? `+${juveData.goalDifference}` : juveData.goalDifference} · ${(
                  juveData.goalsFor / (juveData.playedGames || 1)
                ).toFixed(1)} gol per laga`
              : 'Memuat data...'}
          </div>
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
          <div className="metric-sub" style={{ marginTop: '8px' }}>
            lama → terbaru
          </div>
        </div>
      </div>

      {/* Sub Nav Tabs */}
      <div className="sub-tabs">
        <button
          className={`tab-btn ${activeTab === 'klasemen' ? 'active' : ''}`}
          onClick={() => setActiveTab('klasemen')}
        >
          Klasemen & jadwal
        </button>
        <button
          className={`tab-btn ${activeTab === 'lagalain' ? 'active' : ''}`}
          onClick={() => setActiveTab('lagalain')}
        >
          Laga lain
        </button>
        <button
          className={`tab-btn ${activeTab === 'topskor' ? 'active' : ''}`}
          onClick={() => setActiveTab('topskor')}
        >
          Top skor
        </button>
      </div>

      {/* Content Section: Klasemen Live */}
      {activeTab === 'klasemen' && (
        <div className="grid-main">
          <div className="panel">
            <div className="sec-head">
              <h2 className="sec-title">Klasemen</h2>
              <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                Diperbarui otomatis · data ESPN API
              </small>
            </div>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center' }}>Memuat data klasemen ESPN...</div>
            ) : (
              <table className="standings">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>KLUB</th>
                    <th>MN</th>
                    <th>M</th>
                    <th>S</th>
                    <th>K</th>
                    <th>GM</th>
                    <th>GK</th>
                    <th>SG</th>
                    <th>POIN</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((item) => {
                    const isJuve = item.name.includes('Juventus');
                    return (
                      <tr key={item.id} className={isJuve ? 'juve-row' : ''}>
                        <td><strong>{item.position}</strong></td>
                        <td>
                          <div className="club-cell">
                            {item.logo && (
                              <img
                                src={item.logo}
                                alt={item.name}
                                style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                              />
                            )}
                            <strong>{item.shortName || item.name}</strong>
                          </div>
                        </td>
                        <td>{item.playedGames}</td>
                        <td>{item.won}</td>
                        <td>{item.draw}</td>
                        <td>{item.lost}</td>
                        <td>{item.goalsFor}</td>
                        <td>{item.goalsAgainst}</td>
                        <td>{item.goalDifference > 0 ? `+${item.goalDifference}` : item.goalDifference}</td>
                        <td><strong>{item.points}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Kolom Jadwal */}
          <div className="panel">
            <div className="sec-head">
              <h2 className="sec-title">Jadwal liga</h2>
              <small style={{ color: 'var(--muted)', fontSize: '10px' }}>Mendatang</small>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px', marginBottom: '14px' }}>
                <span style={{ fontSize: '9px', color: 'var(--red)', fontWeight: '900' }}>TANDANG</span>
                <div style={{ fontWeight: '800', fontSize: '13px', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="mini-logo">INT</span> Inter Milan vs Juventus
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Minggu, 1 Nov · 02.45 WIB</span>
                  <span style={{ fontSize: '9px', background: '#f0f1f4', padding: '3px 7px', borderRadius: '4px', fontWeight: '800' }}>► Vidio</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px', marginBottom: '14px' }}>
                <span style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: '900' }}>KANDANG</span>
                <div style={{ fontWeight: '800', fontSize: '13px', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="mini-logo" style={{ background: '#111', color: '#fff' }}>J</span> Juventus vs Parma
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--muted)' }}>Kamis, 5 Nov · 02.45 WIB</span>
                  <span style={{ fontSize: '9px', background: '#f0f1f4', padding: '3px 7px', borderRadius: '4px', fontWeight: '800' }}>► Vidio</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
