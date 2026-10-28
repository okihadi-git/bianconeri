'use client';

import { useState, useEffect } from 'react';

export default function KompetisiPage() {
  const [activeTab, setActiveTab] = useState<'klasemen' | 'lagalain' | 'topskor'>('klasemen');
  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Ambil data Klasemen dari API
  useEffect(() => {
    async function fetchStandings() {
      try {
        const res = await fetch('https://api.football-data.org/v4/competitions/SA/standings', {
          headers: {
            'X-Auth-Token': process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY || '7a3c9383187f412589f1a57a27a3e04f',
          },
        });
        const data = await res.json();
        const table = data?.standings?.[0]?.table || [];
        setStandings(table);
      } catch (err) {
        console.error('Gagal memuat data klasemen:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStandings();
  }, []);

  // Cari data Juventus untuk Top Metrics
  const juveData = standings.find((item) => item.team.name.includes('Juventus'));
  const topTeam = standings[0];
  const pointsBehind = topTeam && juveData ? topTeam.points - juveData.points : 0;

  return (
    <div>
      {/* Navigasi Bar Kapsul Kompetisi */}
      <div className="comp-nav">
        <button className="comp-btn active">🇮🇹 Serie A</button>
        <button className="comp-btn">🇪🇺 Liga Champions</button>
        <button className="comp-btn">🏆 Coppa Italia</button>
        <button className="comp-btn disabled">
          🛡️ Supercoppa Italiana <span className="badge-off">Tidak Ikut</span>
        </button>
        <button className="comp-btn disabled">
          🌍 Piala Super Eropa <span className="badge-off">Tidak Ikut</span>
        </button>
        <button className="comp-btn">✈️ Pramusim & Tur</button>
      </div>

      {/* Top Metrics Cards (Sesuai Gambar Desain) */}
      <div className="top-metrics">
        <div className="metric-card purple-bg">
          <div className="metric-label">Posisi</div>
          <div className="metric-val">#{juveData ? juveData.position : '-'}</div>
          <div className="metric-sub">
            {pointsBehind === 0
              ? 'Memimpin puncak klasemen'
              : `${pointsBehind} poin di belakang ${topTeam?.team?.shortName || topTeam?.team?.name || 'puncak'}`}
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
                  juveData.goalsFor / juveData.playedGames
                ).toFixed(1)} gol per laga`
              : 'Memuat data...'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Form 5 Laga Terakhir</div>
          <div className="form-badges">
            {juveData?.form
              ? juveData.form.split(',').map((res: string, idx: number) => {
                  const bgClass = res === 'W' ? 'bg-m' : res === 'D' ? 'bg-s' : 'bg-k';
                  const label = res === 'W' ? 'M' : res === 'D' ? 'S' : 'K';
                  return (
                    <span key={idx} className={`badge-f ${bgClass}`}>
                      {label}
                    </span>
                  );
                })
              : (
                <>
                  <span className="badge-f bg-s">S</span>
                  <span className="badge-f bg-m">M</span>
                  <span className="badge-f bg-m">M</span>
                  <span className="badge-f bg-s">S</span>
                  <span className="badge-f bg-m">M</span>
                </>
              )}
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

      {/* Content Section 1: Klasemen & Jadwal */}
      {activeTab === 'klasemen' && (
        <div className="grid-main">
          {/* TABEL KLASEMEN LIVE */}
          <div className="panel">
            <div className="sec-head">
              <h2 className="sec-title">Klasemen</h2>
              <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                Diperbarui otomatis · data Live API
              </small>
            </div>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center' }}>Memuat data klasemen...</div>
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
                    <th>5 LAGA TERAKHIR</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((item) => {
                    const isJuve = item.team.name.includes('Juventus');
                    const formArray = item.form ? item.form.split(',') : [];

                    return (
                      <tr key={item.team.id} className={isJuve ? 'juve-row' : ''}>
                        <td><strong>{item.position}</strong></td>
                        <td>
                          <div className="club-cell">
                            <img
                              src={item.team.crest}
                              alt={item.team.name}
                              style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                            />
                            <strong>{item.team.shortName || item.team.name}</strong>
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
                        <td>
                          <div className="form-badges">
                            {formArray.map((res: string, i: number) => {
                              const bgClass = res === 'W' ? 'bg-m' : res === 'D' ? 'bg-s' : 'bg-k';
                              const label = res === 'W' ? 'M' : res === 'D' ? 'S' : 'K';
                              return (
                                <span key={i} className={`badge-f ${bgClass}`} style={{ width: '16px', height: '16px', fontSize: '8px' }}>
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
            )}
          </div>

          {/* JADWAL LIGA (KOLOM KANAN) */}
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

      {/* Content Section 2: Laga Lain */}
      {activeTab === 'lagalain' && (
        <div className="panel">
          <div className="sec-head"><h2 className="sec-title">Intip Laga Pesaing</h2></div>
          <div className="matches-grid">
            <div className="match-card">
              <div className="match-top"><span>SERIE A · PEKAN 9</span><span className="tag-pesaing">PESAING</span></div>
              <div className="match-main"><span>AS Roma</span> <span>1 — 1</span> <span>Inter Milan</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Content Section 3: Top Skor */}
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
