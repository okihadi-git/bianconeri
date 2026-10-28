// Fungsi untuk mengambil data klasemen dari API Football-Data.org
async function getStandings() {
  const res = await fetch('https://api.football-data.org/v4/competitions/SA/standings', {
    headers: {
      'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY || '',
    },
    // Revalidate/Refresh data otomatis setiap 3600 detik (1 jam)
    next: { revalidate: 3600 } 
  });

  if (!res.ok) {
    throw new Error('Gagal mengambil data klasemen');
  }

  return res.json();
}

export default async function KompetisiPage() {
  // Ambil data live
  const standingsData = await getStandings().catch(() => null);
  const standings = standingsData?.standings?.[0]?.table || [];

  return (
    <div>
      <div className="panel">
        <div className="sec-head">
          <h2 className="sec-title">Klasemen Live Serie A</h2>
          <small>Musim 2026/27</small>
        </div>
        <table className="standings">
          <thead>
            <tr>
              <th>#</th>
              <th>KLUB</th>
              <th>MN</th>
              <th>M</th>
              <th>S</th>
              <th>K</th>
              <th>SG</th>
              <th>POIN</th>
            </tr>
          </thead>
          <tbody>
            {standings.length > 0 ? (
              standings.map((item: any) => {
                const isJuve = item.team.name.includes('Juventus');
                return (
                  <tr key={item.team.id} className={isJuve ? 'juve-row' : ''}>
                    <td>{item.position}</td>
                    <td>
                      <div className="club-cell">
                        <img 
                          src={item.team.crest} 
                          alt={item.team.name} 
                          style={{ width: '20px', height: '20px', objectFit: 'contain' }} 
                        />
                        <strong>{item.team.name}</strong>
                      </div>
                    </td>
                    <td>{item.playedGames}</td>
                    <td>{item.won}</td>
                    <td>{item.draw}</td>
                    <td>{item.lost}</td>
                    <td>{item.goalDifference > 0 ? `+${item.goalDifference}` : item.goalDifference}</td>
                    <td><strong>{item.points}</strong></td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>
                  Gagal memuat klasemen live atau API Key belum dipasang.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
