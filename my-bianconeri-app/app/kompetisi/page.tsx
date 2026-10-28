'use client';

import { useState, useEffect } from 'react';

export default function KompetisiPage() {
  const [activeTab, setActiveTab] = useState<'klasemen' | 'lagalain' | 'topskor'>('klasemen');
  const [scheduleSubTab, setScheduleSubTab] = useState<'upcoming' | 'past'>('upcoming');
  
  const [standings, setStandings] = useState<any[]>([]);
  const [juveSchedule, setJuveSchedule] = useState<{ upcoming: any[]; past: any[] }>({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [resStandings, resJuve] = await Promise.all([
          fetch('/api/standings'),
          fetch('/api/juventus'),
        ]);

        const dataStandings = await resStandings.json();
        const dataJuve = await resJuve.json();

        setStandings(dataStandings.standings || []);
        setJuveSchedule({
          upcoming: dataJuve.upcoming || [],
          past: dataJuve.past || [],
        });
      } catch (err) {
        console.error('Gagal mengambil data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const juveData = standings.find((item) => item.name.includes('Juventus'));
  const topTeam = standings[0];
  const pointsBehind = topTeam && juveData ? topTeam.points - juveData.points : 0;

  return (
    <div>
      {/* Navigasi Kapsul Kompetisi */}
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

      {/* Grid Utama 2 Kolom: Klasemen & Jadwal */}
      {activeTab === 'klasemen' && (
        <div className="grid-main" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          
          {/* KOLOM KIRI: TABEL KLASEMEN & BADGE 5 LAGA */}
          <div className="panel" style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="sec-head" style={{ marginBottom: '16px' }}>
              <h2 className="sec-title" style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Klasemen</h2>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                Diperbarui otomatis · data ESPN API
              </small>
            </div>

            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center' }}>Memuat data klasemen...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="standings" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ color: '#888', borderBottom: '1px solid #eee', textAlign: 'left', height: '36px' }}>
                      <th style={{ width: '30px' }}>#</th>
                      <th>KLUB</th>
                      <th style={{ textAlign: 'center' }}>MN</th>
                      <th style={{ textAlign: 'center' }}>M</th>
                      <th style={{ textAlign: 'center' }}>S</th>
                      <th style={{ textAlign: 'center' }}>K</th>
                      <th style={{ textAlign: 'center' }}>GM</th>
                      <th style={{ textAlign: 'center' }}>GK</th>
                      <th style={{ textAlign: 'center' }}>SG</th>
                      <th style={{ textAlign: 'center' }}>POIN</th>
                      <th style={{ textAlign: 'center', minWidth: '110px' }}>5 LAGA TERAKHIR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((item) => {
                      const isJuve = item.name.includes('Juventus');
                      const formLetters = item.form ? item.form.replace(/[^WDL]/g, '').slice(-5).split('') : ['W', 'W', 'D', 'W', 'L'];

                      return (
                        <tr 
                          key={item.id} 
                          style={{ 
                            borderBottom: '1px solid #f5f5f5', 
                            height: '44px',
                            background: isJuve ? 'rgba(230, 0, 35, 0.05)' : 'transparent',
                            fontWeight: isJuve ? '700' : 'normal'
                          }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            {isJuve && <span style={{ width: '3px', height: '16px', background: 'var(--red)', display: 'inline-block', marginRight: '4px', verticalAlign: 'middle' }} />}
                            {item.position}
                          </td>
                          <td>
                            <div className="club-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {item.logo && (
                                <img src={item.logo} alt={item.name} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                              )}
                              <span style={{ color: isJuve ? 'var(--red)' : '#111' }}>{item.shortName || item.name}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>{item.playedGames}</td>
                          <td style={{ textAlign: 'center' }}>{item.won}</td>
                          <td style={{ textAlign: 'center' }}>{item.draw}</td>
                          <td style={{ textAlign: 'center' }}>{item.lost}</td>
                          <td style={{ textAlign: 'center' }}>{item.goalsFor}</td>
                          <td style={{ textAlign: 'center' }}>{item.goalsAgainst}</td>
                          <td style={{ textAlign: 'center', color: item.goalDifference > 0 ? '#10b981' : '#111' }}>
                            {item.goalDifference > 0 ? `+${item.goalDifference}` : item.goalDifference}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: '800' }}>{item.points}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                              {formLetters.map((char: string, i: number) => {
                                const isW = char === 'W';
                                const isD = char === 'D';
                                const bg = isW ? '#10b981' : isD ? '#6b7280' : '#ef4444';
                                const label = isW ? 'M' : isD ? 'S' : 'K';
                                return (
                                  <span
                                    key={i}
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '4px',
                                      background: bg,
                                      color: '#fff',
                                      fontSize: '9px',
                                      fontWeight: '800',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {label}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* KOLOM KANAN: JADWAL & HASIL LAGA JUVENTUS */}
          <div className="panel" style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="sec-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="sec-title" style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>Jadwal Juventus</h2>
              <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '3px', borderRadius: '6px' }}>
                <button
                  onClick={() => setScheduleSubTab('upcoming')}
                  style={{
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    background: scheduleSubTab === 'upcoming' ? '#fff' : 'transparent',
                    boxShadow: scheduleSubTab === 'upcoming' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Mendatang
                </button>
                <button
                  onClick={() => setScheduleSubTab('past')}
                  style={{
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    background: scheduleSubTab === 'past' ? '#fff' : 'transparent',
                    boxShadow: scheduleSubTab === 'past' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Hasil Lampau
                </button>
              </div>
            </div>

            {/* TAB JADWAL MENDATANG */}
            {scheduleSubTab === 'upcoming' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {juveSchedule.upcoming.length > 0 ? (
                  juveSchedule.upcoming.slice(0, 6).map((match) => (
                    <div key={match.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#111' }}>{match.date}</span>
                        <span style={{ fontSize: '9px', fontWeight: '800', color: match.isHome ? '#6b7280' : 'var(--red)' }}>
                          {match.venueText}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                        {match.opponentLogo && (
                          <img src={match.opponentLogo} alt={match.opponent} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                        )}
                        <strong style={{ fontSize: '13px' }}>
                          {match.isHome ? `Juventus vs ${match.opponent}` : `${match.opponent} vs Juventus`}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <span style={{ fontSize: '10px', color: '#6b7280' }}>{match.dayTime}</span>
                        <span style={{ fontSize: '9px', background: '#f3f4f6', padding: '3px 7px', borderRadius: '4px', fontWeight: '800' }}>
                          ► Vidio
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '12px' }}>
                    {loading ? 'Memuat jadwal...' : 'Belum ada jadwal mendatang.'}
                  </div>
                )}
              </div>
            )}

            {/* TAB HASIL MATCH LAMPAU */}
            {scheduleSubTab === 'past' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {juveSchedule.past.length > 0 ? (
                  juveSchedule.past.slice(0, 6).map((match) => (
                    <div key={match.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#111' }}>{match.date}</span>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: '800',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: '#fff',
                            background: match.winner ? '#10b981' : match.juveScore === match.opponentScore ? '#6b7280' : '#ef4444',
                          }}
                        >
                          {match.winner ? 'MENANG' : match.juveScore === match.opponentScore ? 'SERI' : 'KALAH'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {match.opponentLogo && (
                            <img src={match.opponentLogo} alt={match.opponent} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                          )}
                          <strong style={{ fontSize: '13px' }}>
                            {match.isHome ? `vs ${match.opponent}` : `@ ${match.opponent}`}
                          </strong>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '900' }}>
                          {match.isHome ? `${match.juveScore} - ${match.opponentScore}` : `${match.opponentScore} - ${match.juveScore}`}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '12px' }}>
                    {loading ? 'Memuat hasil...' : 'Belum ada data hasil pertandingan.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
