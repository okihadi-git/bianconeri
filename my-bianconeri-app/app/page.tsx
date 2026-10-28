'use client';

import { useState, useEffect } from 'react';

export default function KompetisiPage() {
  const [activeTab, setActiveTab] = useState<'klasemen' | 'lagalain' | 'topskor'>('klasemen');
  const [scheduleTab, setScheduleTab] = useState<'upcoming' | 'past'>('upcoming');
  const [otherMatchesTab, setOtherMatchesTab] = useState<'results' | 'upcoming'>('results');
  const [filterRivalsOnly, setFilterRivalsOnly] = useState(false);
  const [selectedMatchModal, setSelectedMatchModal] = useState<any>(null);

  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initData() {
      try {
        const res = await fetch('/api/competitions');
        const data = await res.json();
        setStandings(data.standings || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  const juveData = standings.find((t) => t.name.includes('Juventus'));
  const topTeam = standings[0];
  const pointsBehind = topTeam && juveData ? topTeam.points - juveData.points : 0;

  return (
    <div className="kompetisi-container">
      {/* 1. TOP METRICS CARDS */}
      <div className="top-metrics">
        <div className="metric-card purple-bg">
          <div className="metric-label">Posisi</div>
          <div className="metric-val">#{juveData ? juveData.position : '-'}</div>
          <div className="metric-sub">
            {pointsBehind === 0 ? 'Memimpin puncak klasemen' : `${pointsBehind} poin di belakang ${topTeam?.shortName || 'puncak'}`}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Poin</div>
          <div className="metric-val">{juveData ? juveData.points : '-'}</div>
          <div className="metric-sub">{juveData ? `${juveData.won}M · ${juveData.draw}S · ${juveData.lost}K` : 'Memuat...'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Gol</div>
          <div className="metric-val">{juveData ? `${juveData.goalsFor}-${juveData.goalsAgainst}` : '-'}</div>
          <div className="metric-sub">{juveData ? `Selisih ${juveData.goalDifference > 0 ? `+${juveData.goalDifference}` : juveData.goalDifference}` : 'Memuat...'}</div>
        </div>
      </div>

      {/* 2. SUB-TABS NAVIGASI */}
      <div className="sub-tabs">
        <button className={`tab-btn ${activeTab === 'klasemen' ? 'active' : ''}`} onClick={() => setActiveTab('klasemen')}>Klasemen & jadwal</button>
        <button className={`tab-btn ${activeTab === 'lagalain' ? 'active' : ''}`} onClick={() => setActiveTab('lagalain')}>Laga lain</button>
        <button className={`tab-btn ${activeTab === 'topskor' ? 'active' : ''}`} onClick={() => setActiveTab('topskor')}>Top skor</button>
      </div>

      {/* 3. TAB CONTENT: KLASEMEN & JADWAL */}
      {activeTab === 'klasemen' && (
        <div className="grid-main">
          {/* KLASEMEN TABEL */}
          <div className="panel">
            <h2 className="sec-title">Klasemen Serie A</h2>
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
                  <th>5 LAGA TERAKHIR</th>
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
                          <img src={item.logo} alt={item.name} style={{ width: 18, height: 18 }} />
                          <span>{item.shortName || item.name}</span>
                        </div>
                      </td>
                      <td>{item.playedGames}</td>
                      <td>{item.won}</td>
                      <td>{item.draw}</td>
                      <td>{item.lost}</td>
                      <td>{item.goalsFor}</td>
                      <td>{item.goalsAgainst}</td>
                      <td style={{ color: item.goalDifference > 0 ? '#10b981' : 'inherit' }}>
                        {item.goalDifference > 0 ? `+${item.goalDifference}` : item.goalDifference}
                      </td>
                      <td><strong>{item.points}</strong></td>
                      <td>
                        <div className="form-badges">
                          {item.form.slice(-5).map((res: string, i: number) => (
                            <span key={i} className={`badge-f ${res === 'M' ? 'bg-m' : res === 'S' ? 'bg-s' : 'bg-k'}`}>
                              {res}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* JADWAL SIDEBAR */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 className="sec-title">Jadwal liga</h2>
              <div>
                <button onClick={() => setScheduleTab('upcoming')} className={`btn-sm ${scheduleTab === 'upcoming' ? 'active' : ''}`}>Mendatang</button>
                <button onClick={() => setScheduleTab('past')} className={`btn-sm ${scheduleTab === 'past' ? 'active' : ''}`}>Hasil</button>
              </div>
            </div>

            {/* Tombol Dummy untuk Membuka Modal Rating */}
            <button 
              onClick={() => setSelectedMatchModal({ title: 'JUVENTUS vs INTER MILAN', juveScore: 2, oppScore: 0 })}
              className="btn-rating-demo"
            >
              ★ Lihat Contoh Rating Pemain (Modal)
            </button>
          </div>
        </div>
      )}

      {/* 4. MODAL POPUP RATING PEMAIN (Meniru fitur 00:06 di Video) */}
      {selectedMatchModal && (
        <div className="modal-overlay" onClick={() => setSelectedMatchModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>RATING PEMAIN · {selectedMatchModal.title}</h3>
              <button onClick={() => setSelectedMatchModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="pitch-container">
                <p style={{ textAlign: 'center', color: '#fff', padding: '40px 0' }}>
                  ⚽ Formasi Lapangan 4-3-3 & Rating Pemain Live
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
