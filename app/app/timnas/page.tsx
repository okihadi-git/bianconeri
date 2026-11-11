'use client';

import { useMemo, useState } from 'react';
import Face from '@/components/Face';
import { useFetch } from '@/components/kp';
import { PlayerAvatar } from '@/components/team';
import type { TimnasResponse, TmMatch, TmPlayer, TmSide } from '@/lib/timnas';
import type { SquadPlayer, SquadResponse } from '@/lib/types';
import './timnas.css';

/* ---------- util ---------- */

const shortName = (full: string) => {
  const t = full.trim().split(/\s+/);
  return t.length < 2 ? full : t.slice(1).join(' ');
};
const num = (n: number) => new Intl.NumberFormat('id-ID').format(n);
const rate = (r: number | null) => (r == null ? '–' : r.toFixed(1).replace('.', ','));
const tone = (r: number | null) => (r == null ? 'na' : r >= 7 ? 'hi' : r >= 6 ? 'mid' : 'lo');
const wib = { timeZone: 'Asia/Jakarta' } as const;
const fmtDay = (iso: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', ...wib }).format(new Date(iso));
const fmtTime = (iso: string) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, ...wib }).format(new Date(iso)).replace('.', ':');
const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', wib).format(new Date(iso));

const STATE_LABEL = { selesai: 'selesai', berlangsung: 'berlangsung', 'akan datang': 'akan datang' } as const;

function Flag({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="tn-flag" loading="lazy" /> : null;
}

const resultOf = (m: TmMatch, country: string): 'M' | 'K' | 'S' | null => {
  if (m.status !== 'post' || m.home.score == null || m.away.score == null) return null;
  const isHome = m.home.country === country;
  const [a, b] = isHome ? [m.home.score, m.away.score] : [m.away.score, m.home.score];
  return a > b ? 'M' : a < b ? 'K' : 'S';
};

/* ---------- bagian ---------- */

function PlayerCard({ p }: { p: TmPlayer }) {
  return (
    <article className="tn-pcard">
      <header>
        <Face src={p.photo} name={p.name} size={52} />
        <div>
          <div className="tn-pname">
            <Flag src={p.flag} />
            <b>{p.name}</b>
          </div>
          <span className={`tn-badge tn-${p.status.tone}`}>{p.status.label}</span>
        </div>
      </header>
      <div className="tn-mini">
        <div><b>{p.minutes}&apos;</b><span>menit</span></div>
        <div><b>{p.appearances}/{p.countryMatches}</b><span>tampil</span></div>
        <div><b>{p.restDays ?? '–'}</b><span>hari rehat</span></div>
      </div>
      <div className="tn-bar"><i className={`tn-${p.status.tone}`} style={{ width: `${Math.max(4, Math.round(p.load * 100))}%` }} /></div>
    </article>
  );
}

function SideLine({ s }: { s: TmSide }) {
  return (
    <span className="tn-team">
      <Flag src={s.flag} />
      <b>{s.country}</b>
    </span>
  );
}

function Derby({ m, byId }: { m: TmMatch; byId: Map<string, TmPlayer> }) {
  const side = (which: 'home' | 'away') => (
    <div className="tn-dside">
      {m.entries
        .filter((e) => e.side === which)
        .map((e) => {
          const p = byId.get(e.playerId);
          if (!p) return null;
          return (
            <div key={e.playerId} className={e.minutes > 0 ? '' : 'off'}>
              <Face src={p.photo} name={p.name} size={44} />
              <small>{shortName(p.name)}</small>
              {e.minutes > 0 && <span className={`tn-r tn-r-${tone(e.rating)}`}>{rate(e.rating)}</span>}
            </div>
          );
        })}
    </div>
  );
  return (
    <div className="tn-derby">
      <div className="tn-dhead">
        <b>{m.home.country}</b>
        <strong>{m.home.score}–{m.away.score}</strong>
        <b>{m.away.country}</b>
      </div>
      <small className="tn-dsub">{fmtDay(m.iso)}{m.venue ? ` · ${m.venue}` : ''}</small>
      <div className="tn-dbody">
        {side('home')}
        <span>vs</span>
        {side('away')}
      </div>
    </div>
  );
}

function Nationalities() {
  const res = useFetch<SquadResponse>('/api/squad');
  const players = res.data?.players ?? [];
  const groups = useMemo(() => {
    const map = new Map<string, SquadPlayer[]>();
    for (const p of players) map.set(p.nation[0] || 'Kebangsaan tidak diketahui', [...(map.get(p.nation[0] || 'Kebangsaan tidak diketahui') ?? []), p]);
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [players]);
  if (!players.length) return null;
  return (
    <section className="kp-card tn-card">
      <header className="kp-card-head">
        <h2 className="kp-title">Skuad menurut kebangsaan</h2>
        <small className="kp-muted">Kebangsaan utama di sumber data, bukan daftar panggilan</small>
      </header>
      {groups.map(([nation, list]) => (
        <div key={nation}>
          <div className="kp-group">{nation} · {list.length}</div>
          <div className="sq-grid">
            {list.map((p) => (
              <div className="sq-player" key={p.id}>
                <PlayerAvatar p={p} />
                <div className="sq-info">
                  <div className="sq-name"><b>{p.name}</b></div>
                  <div className="kp-muted sq-meta">{[p.position, p.age != null ? `${p.age} th` : ''].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ---------- halaman ---------- */

export default function TimnasPage() {
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const res = useFetch<TimnasResponse>(`/api/timnas${key ? `?jeda=${key}` : ''}`);
  const d = res.data;

  const byId = useMemo(() => new Map((d?.players ?? []).map((p) => [p.id, p])), [d]);
  const matchById = useMemo(() => new Map((d?.matches ?? []).map((m) => [m.id, m])), [d]);
  const days = useMemo(() => {
    const map = new Map<string, TmMatch[]>();
    for (const m of d?.matches ?? []) map.set(dayKey(m.iso), [...(map.get(dayKey(m.iso)) ?? []), m]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [d]);

  const hasPlayers = Boolean(d && d.players.length);
  const upcoming = d?.state === 'akan datang';
  const best = d?.best ? byId.get(d.best.playerId) : null;
  const top = d?.top ? byId.get(d.top.playerId) : null;
  const label = d?.breaks.find((b) => b.key === d.breakKey)?.label ?? 'Jeda internasional';

  const recap = d
    ? `${label}: ${d.totals.called} pemain Juventus dipanggil timnas, ${d.totals.played} turun main, ${d.totals.goals} gol dan ${d.totals.assists} assist, ${num(d.totals.minutes)} menit di ${d.totals.matches} laga.${d.totals.injured.length ? ` Cedera saat bertugas: ${d.totals.injured.join(', ')}.` : ''}`
    : '';
  const share = async () => {
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: 'Juventus di Timnas', text: recap, url: window.location.href });
      else {
        await navigator.clipboard.writeText(`${recap}\n${window.location.href}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* dibatalkan pengguna */
    }
  };

  return (
    <div className="kp" id="timnas">
      <section className="kp-card tn-card">
        <header className="kp-card-head">
          <h2 className="kp-title">Juventus di Timnas</h2>
          <small className="kp-muted">Pantau pemain Juventus saat membela negaranya · laga timnas senior</small>
        </header>
        <div className="tn-tabs">
          {(d?.breaks ?? []).map((b) => (
            <button key={b.key} type="button" className={`tn-tab${d?.breakKey === b.key ? ' active' : ''}`} onClick={() => setKey(b.key)}>
              <b>{b.label}</b>
              <small>{STATE_LABEL[b.state]}</small>
            </button>
          ))}
        </div>
      </section>

      {res.loading && <div className="kp-card tn-card"><div className="kp-empty">Memuat data timnas… pemuatan pertama bisa memakan waktu karena banyak laga yang dicek.</div></div>}
      {!res.loading && (res.error || !d) && (
        <div className="kp-card tn-card"><div className="kp-empty">Data timnas belum bisa dimuat. Skuad Juventus atau ESPN sedang tidak bisa dihubungi; coba muat ulang beberapa saat lagi.</div></div>
      )}

      {d && !res.loading && (
        <>
          <div className="kp-metrics">
            <div className="kp-metric kp-metric-red">
              <div className="kp-metric-label">Dipanggil</div>
              <div className="kp-metric-val">{hasPlayers ? d.totals.called : '–'}</div>
              <div className="kp-metric-sub">{hasPlayers ? `${d.totals.played} pemain turun main` : upcoming ? 'Daftar panggilan belum tersedia' : 'Belum ada pemain tercatat'}</div>
            </div>
            <div className="kp-metric">
              <div className="kp-metric-label">Gol · assist</div>
              <div className="kp-metric-val">{hasPlayers ? `${d.totals.goals} · ${d.totals.assists}` : '–'}</div>
              <div className="kp-metric-sub">untuk timnas</div>
            </div>
            <div className="kp-metric">
              <div className="kp-metric-label">Total menit</div>
              <div className="kp-metric-val">{hasPlayers ? num(d.totals.minutes) : '–'}</div>
              <div className="kp-metric-sub">{d.totals.matches} laga selesai</div>
            </div>
            <div className="kp-metric">
              <div className="kp-metric-label">Cedera</div>
              <div className={`kp-metric-val${d.totals.injured.length ? ' tn-red-text' : ''}`}>{hasPlayers ? d.totals.injured.length : '–'}</div>
              <div className="kp-metric-sub">{d.totals.injured.length ? d.totals.injured.map(shortName).join(', ') : 'saat bertugas'}</div>
            </div>
          </div>

          {hasPlayers && (
            <div className="tn-recap">
              <span>Rekap jeda internasional.</span>
              <button type="button" onClick={share}>{copied ? 'Tersalin' : 'Bagikan rekap'}</button>
            </div>
          )}

          {d.warnings.length > 0 && (
            <div className="tn-warn">
              {d.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}

          {hasPlayers ? (
            <section className="kp-card tn-card">
              <header className="kp-card-head">
                <h2 className="kp-title">Pulang dengan selamat?</h2>
                {d.afterBreak && <small className="kp-muted">Laga Juventus berikutnya: {d.afterBreak.opponent} · {fmtDay(d.afterBreak.iso)}</small>}
              </header>
              <div className="tn-pgrid">
                {d.players.map((p) => (
                  <PlayerCard key={p.id} p={p} />
                ))}
              </div>
              <p className="tn-note">
                Menit dihitung dari susunan pemain dan pergantian (tanpa injury time). “Dipanggil” = tercatat di susunan laga (inti atau cadangan), karena ESPN tidak menyediakan daftar panggilan resmi. “Cedera saat
                bertugas” diambil dari komentar laga ESPN ketika pemain diganti karena cedera; kondisi pastinya menunggu kabar klub. “Masuk daftar cedera klub” dari data cedera FotMob. “Rawan lelah” = 270 menit atau lebih,
                atau 180 menit atau lebih dengan hari rehat 3 hari atau kurang. Jarak tempuh tidak ditampilkan karena tidak ada sumber koordinat.
              </p>
            </section>
          ) : (
            <section className="kp-card tn-card">
              <div className="kp-empty">
                {upcoming
                  ? 'Jeda ini belum dimulai. ESPN baru mengisi susunan pemain saat laga berlangsung, jadi daftar pemain Juventus yang dipanggil belum bisa ditampilkan. Jadwal laga negara-negara mereka ada di bawah.'
                  : 'Tidak ada pemain Juventus yang tercatat di susunan laga timnas pada jeda ini menurut ESPN.'}
              </div>
            </section>
          )}

          {(best || top) && (
            <div className="tn-hl">
              {best && d.best && (
                <div className="tn-hcard">
                  <Face src={best.photo} name={best.name} size={52} />
                  <div>
                    <small>RATING RATA-RATA TERBAIK</small>
                    <b>{best.name}</b>
                    <span><Flag src={best.flag} /> {best.country} · {d.best.matches} laga</span>
                  </div>
                  <strong className={`tn-r tn-r-${tone(d.best.avg)} big`}>{rate(d.best.avg)}</strong>
                </div>
              )}
              {top && d.top && (
                <div className="tn-hcard">
                  <Face src={top.photo} name={top.name} size={52} />
                  <div>
                    <small>KONTRIBUSI GOL TERBANYAK</small>
                    <b>{top.name}</b>
                    <span><Flag src={top.flag} /> {d.top.goals} gol · {d.top.assists} assist</span>
                  </div>
                  <strong className="tn-num">{d.top.goals + d.top.assists}</strong>
                </div>
              )}
            </div>
          )}

          {d.derby.length > 0 && (
            <section className="kp-card tn-card">
              <header className="kp-card-head">
                <h2 className="kp-title">Derby Juventus</h2>
                <small className="kp-muted">Rekan setim saling berhadapan</small>
              </header>
              <div className="tn-derbys">
                {d.derby.map((id) => {
                  const m = matchById.get(id);
                  return m ? <Derby key={id} m={m} byId={byId} /> : null;
                })}
              </div>
            </section>
          )}

          {d.countries.length > 0 && (
            <section className="kp-card tn-card">
              <header className="kp-card-head">
                <h2 className="kp-title">Per negara</h2>
                <small className="kp-muted">{d.countries.length} negara · ⌂ kandang · ✈ tandang · rating = estimasi</small>
              </header>
              <div className="tn-countries">
                {d.countries.map((c) => (
                  <div key={c.country} className="tn-country">
                    <header>
                      <span><Flag src={c.flag} /> <b>{c.country}</b></span>
                      <small>{c.playerIds.length ? `${c.playerIds.length} dipanggil` : 'tidak ada pemain tercatat'}</small>
                    </header>
                    <ul className="tn-cm">
                      {c.matchIds.map((id) => matchById.get(id)).filter((m): m is TmMatch => Boolean(m)).map((m) => {
                        const isHome = m.home.country === c.country;
                        const opp = isHome ? m.away : m.home;
                        const r = resultOf(m, c.country);
                        const mine = isHome ? m.home.score : m.away.score;
                        const theirs = isHome ? m.away.score : m.home.score;
                        return (
                          <li key={m.id}>
                            <span className={`tn-res tn-res-${r ?? 'x'}`}>{r ?? '·'}</span>
                            <span title={isHome ? 'Kandang' : 'Tandang'}>{isHome ? '⌂' : '✈'}</span>
                            <span className="tn-opp"><Flag src={opp.flag} /> {opp.country}</span>
                            <b>{r ? `${mine}–${theirs}` : fmtDay(m.iso).split(',')[1]?.trim() ?? ''}</b>
                          </li>
                        );
                      })}
                    </ul>
                    {c.playerIds.map((pid) => {
                      const p = byId.get(pid);
                      if (!p) return null;
                      return (
                        <div className="tn-prow" key={pid}>
                          <Face src={p.photo} name={p.name} size={40} />
                          <div>
                            <b>{p.name}</b>
                            <small>{p.appearances} laga · {p.minutes}&apos; · {p.goals} gol · {p.assists} assist</small>
                            <div className="tn-chips">
                              {p.ratings.map((r) => (
                                <span key={r.matchId} className={`tn-r tn-r-${tone(r.rating)}`} title={matchById.get(r.matchId)?.venue}>
                                  {rate(r.rating)}{r.goals > 0 ? ' ⚽' : ''}{r.assists > 0 ? ' A' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                          <strong className={`tn-r tn-r-${tone(p.avgRating)} big`}>{rate(p.avgRating)}</strong>
                        </div>
                      );
                    })}
                    {c.notListed.length > 0 && <p className="tn-nl">Tidak tercatat di susunan laga: {c.notListed.map(shortName).join(', ')}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {days.length > 0 && (
            <section className="kp-card tn-card">
              <header className="kp-card-head">
                <h2 className="kp-title">Jadwal &amp; hasil (WIB)</h2>
                <small className="kp-muted">{d.matches.length} laga · sumber ESPN · hanya negara yang punya pemain Juventus</small>
              </header>
              {days.map(([k, list]) => (
                <div key={k} className="tn-day">
                  <h3>{fmtDay(list[0].iso)}</h3>
                  <div className="tn-mgrid">
                    {list.map((m) => (
                      <div key={m.id} className="tn-mcard">
                        <small className="tn-st">{m.status === 'post' ? 'FT' : m.status === 'live' ? 'LIVE' : fmtTime(m.iso)}</small>
                        <div className="tn-mscore">
                          <SideLine s={m.home} />
                          <strong>{m.status === 'pre' ? 'vs' : `${m.home.score}–${m.away.score}`}</strong>
                          <SideLine s={m.away} />
                        </div>
                        <div className="tn-mplayers">
                          {m.entries.filter((e) => e.minutes > 0).map((e) => {
                            const p = byId.get(e.playerId);
                            return p ? (
                              <span key={e.playerId} title={p.name}>
                                <Face src={p.photo} name={p.name} size={30} />
                                <span className={`tn-r tn-r-${tone(e.rating)}`}>{rate(e.rating)}</span>
                              </span>
                            ) : null;
                          })}
                        </div>
                        <small className="tn-msub">{[m.competition, m.venue].filter(Boolean).join(' · ')}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          <footer className="kp-legend">
            <span className="kp-legend-note">
              Laga timnas dan susunan pemain dari ESPN; kompetisi yang dicek: persahabatan, UEFA Nations League, CONCACAF Nations League, dan kualifikasi Piala Afrika. Kompetisi lain tidak tercakup. Rating adalah estimasi otomatis dari
              statistik ESPN dengan skala 6,0 sebagai rata-rata, bukan rating resmi. Pencocokan pemain memakai nama dan negara; nama yang berbeda penulisan bisa terlewat.
            </span>
          </footer>
        </>
      )}

      {(!d || !hasPlayers) && <Nationalities />}
    </div>
  );
}

