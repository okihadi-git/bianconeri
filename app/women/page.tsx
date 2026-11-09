'use client';

import ClubProfile from '@/components/ClubProfile';
import { useFetch } from '@/components/kp';
import type { WMatch, WomenResponse } from '@/lib/women';

const WIB = 'Asia/Jakarta';

/** "Jum, 13 Nov" */
function dayLabel(iso: string) {
  const parts = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: WIB }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('weekday')}, ${get('day')} ${get('month')}`;
}
/** "00:45 WIB" */
const timeLabel = (iso: string) => `${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: WIB }).format(new Date(iso))} WIB`;

function MatchRow({ m }: { m: WMatch }) {
  const done = m.status === 'post';
  return (
    <li className="wm-match">
      <div className="wm-when">
        <b>{dayLabel(m.iso)}</b>
        <small>{m.status === 'live' ? 'LIVE' : timeLabel(m.iso)}</small>
      </div>
      <div className="wm-what">
        <span className={`wm-badge wm-${m.kind}`}>{m.comp}</span>
        <span className="wm-vs">
          {m.home ? 'vs' : 'di'} <b>{m.opponent}</b>
        </span>
        {m.venue && <small className="wm-venue">{m.venue}</small>}
      </div>
      {done && m.score && (
        <span className={`wm-score wm-${m.result}`} title={m.result === 'W' ? 'Menang' : m.result === 'L' ? 'Kalah' : 'Seri'}>
          {m.score.us}-{m.score.them}
        </span>
      )}
    </li>
  );
}

export default function WomenPage() {
  const res = useFetch<WomenResponse>('/api/women');
  const d = res.data;

  const juve = d?.standings.find((r) => r.isJuve) ?? null;
  const upcoming = (d?.matches ?? []).filter((m) => m.status !== 'post');
  const results = (d?.matches ?? []).filter((m) => m.status === 'post').reverse();
  const next = upcoming[0] ?? null;
  const last = results[0] ?? null;
  const leagueName = d?.league?.name ?? 'Serie A Women';

  return (
    <div className="kp" id="women-live">
      <div className="kp-metrics">
        <div className="kp-metric kp-metric-red">
          <div className="kp-metric-label">Posisi {leagueName}</div>
          <div className="kp-metric-val">{juve ? `#${juve.position}` : '–'}</div>
          <div className="kp-metric-sub">{juve ? `${juve.points} poin dari ${juve.played} laga` : res.loading ? 'Memuat data…' : 'Klasemen belum tersedia'}</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Rekor liga</div>
          <div className="kp-metric-val">{juve ? `${juve.won}-${juve.draw}-${juve.lost}` : '–'}</div>
          <div className="kp-metric-sub">{juve ? `menang-seri-kalah · gol ${juve.goalsFor}–${juve.goalsAgainst}` : ' '}</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Laga berikutnya</div>
          <div className="kp-metric-val sq-coach">{next?.opponent ?? '–'}</div>
          <div className="kp-metric-sub">{next ? `${next.comp} · ${dayLabel(next.iso)} · ${timeLabel(next.iso)}` : res.loading ? ' ' : 'Belum ada jadwal'}</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Hasil terakhir</div>
          <div className="kp-metric-val">{last?.score ? `${last.score.us}-${last.score.them}` : '–'}</div>
          <div className="kp-metric-sub">{last ? `${last.home ? 'vs' : 'di'} ${last.opponent} · ${last.comp}` : ' '}</div>
        </div>
      </div>

      {res.error && <div className="kp-card kp-empty">Data Juventus Women belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div>}
      {d && d.warnings.length > 0 && (
        <div className="kp-card wm-warn">
          {d.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <div className="wm-grid">
        <section className="kp-card">
          <header className="kp-card-head">
            <h2 className="kp-title">Klasemen {leagueName}</h2>
            <small className="kp-muted">{d?.league ? `${d.league.name} ${d.league.season}` : ' '}</small>
          </header>
          {res.loading && <div className="kp-empty">Memuat klasemen…</div>}
          {d && !d.standings.length && !res.loading && <div className="kp-empty">Klasemen belum tersedia dari ESPN.</div>}
          {d && d.standings.length > 0 && (
            <div className="kp-table-wrap wm-table-wrap">
              <table className="wm-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th className="wm-l">Klub</th>
                    <th>MN</th>
                    <th>M</th>
                    <th>S</th>
                    <th>K</th>
                    <th>SG</th>
                    <th>Poin</th>
                  </tr>
                </thead>
                <tbody>
                  {d.standings.map((r) => (
                    <tr key={r.id || r.name} className={r.isJuve ? 'wm-juve' : ''}>
                      <td>{r.position}</td>
                      <td className="wm-l">
                        <span className="wm-club">
                          {r.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.logo} alt="" width={20} height={20} loading="lazy" />
                          ) : (
                            <i className="wm-nologo" />
                          )}
                          {r.name}
                        </span>
                      </td>
                      <td>{r.played}</td>
                      <td>{r.won}</td>
                      <td>{r.draw}</td>
                      <td>{r.lost}</td>
                      <td>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
                      <td>
                        <b>{r.points}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="kp-card">
          <header className="kp-card-head">
            <h2 className="kp-title">Jadwal & hasil</h2>
            <small className="kp-muted">Serie A Women dan Liga Champions Wanita · jam WIB</small>
          </header>
          {res.loading && <div className="kp-empty">Memuat jadwal…</div>}
          {d && !d.matches.length && !res.loading && <div className="kp-empty">Jadwal dan hasil belum tersedia dari ESPN.</div>}
          {upcoming.length > 0 && (
            <>
              <h3 className="wm-sub">Berikutnya</h3>
              <ul className="wm-list">
                {upcoming.slice(0, 6).map((m) => (
                  <MatchRow key={m.id} m={m} />
                ))}
              </ul>
            </>
          )}
          {results.length > 0 && (
            <>
              <h3 className="wm-sub">Hasil terakhir</h3>
              <ul className="wm-list">
                {results.slice(0, 6).map((m) => (
                  <MatchRow key={m.id} m={m} />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <h2 className="kp-title wm-section">Profil & sejarah klub</h2>
      <ClubProfile club="juventus-women" id="women" tierLabel="Di kasta tertinggi" />
    </div>
  );
}
