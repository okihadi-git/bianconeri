'use client';

import { useFetch } from '@/components/kp';
import { countryId, flagUrl } from '@/lib/countries';
import { dayLabel, timeLabel } from '@/lib/wib';
import type { SquadGroup, SquadPlayer } from '@/lib/types';
import type { WMatch, WomenResponse } from '@/lib/women';

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

const GROUPS: SquadGroup[] = ['Kiper', 'Bek', 'Gelandang', 'Penyerang', 'Lainnya'];

function Flag({ nation }: { nation: string }) {
  const url = flagUrl(nation);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className="wm-flag" src={url} alt={countryId(nation)} title={countryId(nation)} width={20} height={14} loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} /> : <i className="wm-flag wm-noflag" />;
}

function SquadCard({ players }: { players: SquadPlayer[] }) {
  return (
    <section className="kp-card wm-block">
      <header className="kp-card-head">
        <h2 className="kp-title">Skuad Juventus Women</h2>
        <small className="kp-muted">Nomor punggung, negara, usia</small>
      </header>
      <div className="wm-squad">
        {GROUPS.map((g) => {
          const list = players.filter((p) => p.group === g);
          if (!list.length) return null;
          return (
            <div key={g}>
              <h3 className="wm-group">
                {g} · {list.length}
              </h3>
              <div className="wm-chips">
                {list.map((p) => (
                  <div className="wm-chip" key={p.id}>
                    <span className="wm-no">{p.jersey}</span>
                    {p.nation[0] ? <Flag nation={p.nation[0]} /> : <i className="wm-flag wm-noflag" />}
                    <span className="wm-pname">{p.name}</span>
                    {p.age != null && <small>{p.age}</small>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TransferList({ title, rows, dir }: { title: string; rows: NonNullable<WomenResponse['transfers']>['in']; dir: 'dari' | 'ke' }) {
  return (
    <div>
      <h3 className="wm-group">{title}</h3>
      {rows.length ? (
        <ul className="wm-tr">
          {rows.map((t) => (
            <li key={`${t.id}${t.iso}`}>
              <b>{t.name}</b>
              <span>
                {dir} {t.club}
                {t.loan ? ' · pinjaman' : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="kp-muted">Tidak ada.</p>
      )}
    </div>
  );
}

function TeamCard({ d }: { d: WomenResponse }) {
  const info = d.info;
  const tr = d.transfers;
  return (
    <section className="kp-card wm-block">
      <header className="kp-card-head">
        <h2 className="kp-title">Tim & transfer</h2>
        <small className="kp-muted">Pelatih, kapten, rekrutan musim ini</small>
      </header>
      <div className="wm-team">
        {info && (info.coach || info.captain || info.venue) && (
          <p className="wm-meta">
            {info.coach && (
              <span>
                Pelatih <b>{info.coach}</b>
              </span>
            )}
            {info.captain && (
              <span>
                Kapten <b>{info.captain}</b>
              </span>
            )}
            {info.venue && (
              <span>
                Kandang <b>{info.venue}</b>
              </span>
            )}
          </p>
        )}
        {info && info.competitions.length > 0 && <p className="wm-comps">Musim {d.league?.season ?? ''}: {info.competitions.join(', ').replace(/, ([^,]*)$/, ' dan $1')}.</p>}
        {tr ? (
          <div className="wm-trgrid">
            <TransferList title={`Rekrutan ${tr.label}`} rows={tr.in} dir="dari" />
            <TransferList title="Keluar" rows={tr.out} dir="ke" />
          </div>
        ) : (
          <p className="kp-muted">Data transfer musim ini belum tersedia dari sumber data.</p>
        )}
        <p className="wm-src kp-muted">Sumber: FotMob (skuad, pelatih, transfer). {!info?.captain && 'Kapten tidak ditandai di data sumber. '}Data tidak resmi dan bisa terlambat diperbarui.</p>
      </div>
    </section>
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

      {d && d.squad.length > 0 && <SquadCard players={d.squad} />}
      {d && (d.info || d.transfers) && <TeamCard d={d} />}
    </div>
  );
}
