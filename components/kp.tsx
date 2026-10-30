'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Detail, Letter, Match, PlayerStat, SimpleMatch, Team } from '@/lib/types';

/* ---------- helper ---------- */

export const JUVE_LOGO = 'https://a.espncdn.com/i/teamlogos/soccer/500/111.png';
export const FORM_LABEL: Record<Letter, string> = { W: 'M', D: 'S', L: 'K' };
export const RESULT_WORD: Record<Letter, string> = { W: 'menang', D: 'seri', L: 'kalah' };
const DERBY: Record<string, string> = { Torino: 'Derby della Mole', 'Inter Milan': "Derby d'Italia" };

export const fmtDecimal = (n: number) => n.toFixed(1).replace('.', ',');
export const fmtSigned = (n: number) => (n > 0 ? `+${n}` : String(n));
const num = (v: string) => parseFloat(String(v).replace(/[^\d.]/g, '')) || 0;

export function calendarUrl(m: Match) {
  const start = new Date(m.iso);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const title = m.isHome ? `Juventus vs ${m.opponent}` : `${m.opponent} vs Juventus`;
  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${f(start)}/${f(end)}` +
    `&details=${encodeURIComponent(`${m.competition}${m.week ? ` · Pekan ${m.week}` : ''}`)}` +
    `&location=${encodeURIComponent(m.venue)}`
  );
}

const TZ = 'Asia/Jakarta';

/** "Min, 1 Nov, 23.30 WIB" */
export function fmtWhen(iso: string) {
  const d = new Date(iso);
  const wd = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: TZ }).format(d);
  const dm = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: TZ }).format(d);
  return `${wd.replace('.', '')}, ${dm.replace('.', '')}, ${fmtClock(d)} WIB`;
}

/** Jam WIB, mis. "14.25" */
export function fmtClock(d: Date) {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ })
    .format(d)
    .replace(':', '.');
}

/** "League Phase - Matchday 4" → "Matchday 4" */
export function shortRound(round: string) {
  return round.split(/\s[-–]\s/).pop()?.trim() ?? '';
}

export function monthOf(iso: string) {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(
    new Date(iso)
  );
}

/** Ambil JSON dari URL; `url = null` berarti belum perlu mengambil. */
export function useFetch<T>(url: string | null) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: boolean }>({
    data: null,
    loading: Boolean(url),
    error: false,
  });
  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: false });
    fetch(url)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || j?.error) throw new Error('fetch');
        return j as T;
      })
      .then((data) => !cancelled && setState({ data, loading: false, error: false }))
      .catch(() => !cancelled && setState({ data: null, loading: false, error: true }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}

/* ---------- potongan kecil ---------- */

export function FormBadges({ form }: { form: Letter[] }) {
  if (!form.length) return <span className="kp-muted">–</span>;
  return (
    <div className="kp-form">
      {form.map((l, i) => (
        <span
          key={i}
          className={`kp-fb kp-fb-${l}${i === form.length - 1 ? ' latest' : ''}`}
          title={RESULT_WORD[l]}
        >
          {FORM_LABEL[l]}
        </span>
      ))}
    </div>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  return (
    <div className="kp-pager">
      <button className="kp-pager-btn" disabled={page === 0} onClick={() => onChange(page - 1)}>
        ‹ Sebelumnya
      </button>
      <span>
        {from}–{to} dari {total}
      </span>
      <button className="kp-pager-btn" disabled={to >= total} onClick={() => onChange(page + 1)}>
        Berikutnya ›
      </button>
    </div>
  );
}

export function CompSelect({
  value,
  onChange,
  options,
  allLabel = 'Semua kompetisi',
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string | null;
}) {
  return (
    <label className="kp-select-wrap">
      <span className="sr-only">Kompetisi</span>
      <select className="kp-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {allLabel && <option value="all">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ---------- klasemen ---------- */

export interface ZoneDef {
  from: number;
  to: number;
  cls: 'ucl' | 'uel' | 'rel';
  label: string;
}

export const SERIE_A_ZONES: ZoneDef[] = [
  { from: 1, to: 4, cls: 'ucl', label: 'Liga Champions (1–4)' },
  { from: 5, to: 5, cls: 'uel', label: 'Liga Europa (5)' },
  { from: 18, to: 20, cls: 'rel', label: 'Degradasi (18–20)' },
];

export const EUROPA_ZONES: ZoneDef[] = [
  { from: 1, to: 8, cls: 'ucl', label: 'Langsung ke 16 besar (1–8)' },
  { from: 9, to: 24, cls: 'uel', label: 'Playoff (9–24)' },
  { from: 25, to: 36, cls: 'rel', label: 'Tersingkir (25–36)' },
];

export function StandingsCard({
  title = 'Klasemen',
  subtitle,
  standings,
  loading,
  error,
  zones,
}: {
  title?: string;
  subtitle?: string;
  standings: Team[];
  loading: boolean;
  error: boolean;
  zones: ZoneDef[];
}) {
  const zoneOf = (pos: number) => zones.find((z) => pos >= z.from && pos <= z.to)?.cls ?? '';
  return (
    <section className="kp-card">
      <header className="kp-card-head">
        <h2 className="kp-title">{title}</h2>
        <small className="kp-muted">{subtitle}</small>
      </header>

      {loading ? (
        <div className="kp-empty">Memuat data klasemen…</div>
      ) : error || !standings.length ? (
        <div className="kp-empty">Klasemen belum bisa dimuat. Coba muat ulang halaman.</div>
      ) : (
        <div className="kp-table-wrap">
          <table className="kp-table">
            <thead>
              <tr>
                <th className="c-pos">#</th>
                <th className="c-club">Klub</th>
                <th>MN</th>
                <th>M</th>
                <th>S</th>
                <th>K</th>
                <th className="c-gf">GM</th>
                <th className="c-ga">GK</th>
                <th>SG</th>
                <th>Poin</th>
                <th className="c-form">5 laga terakhir</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((t) => {
                const zone = zoneOf(t.position);
                const isJuve = t.name.includes('Juventus');
                return (
                  <tr key={t.id} className={`${zone ? `zone-${zone}` : ''}${isJuve ? ' me' : ''}`}>
                    <td className="c-pos">{t.position}</td>
                    <td className="c-club">
                      <div className="kp-club">
                        <span className="kp-abbr">{t.shortName}</span>
                        {t.logo && <img src={t.logo} alt="" className="kp-logo" />}
                        <span className="kp-club-name">{t.name}</span>
                      </div>
                    </td>
                    <td>{t.playedGames}</td>
                    <td>{t.won}</td>
                    <td>{t.draw}</td>
                    <td>{t.lost}</td>
                    <td className="c-gf">{t.goalsFor}</td>
                    <td className="c-ga">{t.goalsAgainst}</td>
                    <td className={t.goalDifference > 0 ? 'pos' : t.goalDifference < 0 ? 'neg' : ''}>
                      {fmtSigned(t.goalDifference)}
                    </td>
                    <td className="c-pts">{t.points}</td>
                    <td className="c-form">
                      <FormBadges form={t.form} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <footer className="kp-legend">
        {zones.map((z) => (
          <span key={z.label}>
            <i className={`lg lg-${z.cls}`} /> {z.label}
          </span>
        ))}
        <span className="kp-legend-note">M menang · S seri · K kalah · kanan = laga terbaru</span>
      </footer>
    </section>
  );
}

/* ---------- detail pertandingan ---------- */

function MatchDetail({ m, d }: { m: Match; d?: Detail }) {
  return (
    <div className="kp-detail">
      {m.records && (m.records.juve || m.records.opp) && (
        <div className="kp-detail-records">
          <span>
            <b>{m.isHome ? 'Juventus' : m.opponent}</b> {m.isHome ? m.records.juve : m.records.opp}
          </span>
          <span>
            <b>{m.isHome ? m.opponent : 'Juventus'}</b> {m.isHome ? m.records.opp : m.records.juve}
          </span>
        </div>
      )}

      {(!d || d.loading) && <div className="kp-muted">Memuat statistik…</div>}
      {d?.error && <div className="kp-muted">Statistik pertandingan ini belum tersedia di ESPN.</div>}

      {d?.stats && d.stats.length > 0 && (
        <div className="kp-stats">
          <div className="kp-stats-head">
            <b>Juventus</b>
            <b>{m.opponent}</b>
          </div>
          {d.stats.map((s) => {
            const a = num(s.juve);
            const b = num(s.opp);
            const share = a + b === 0 ? 50 : (a / (a + b)) * 100;
            return (
              <div className="kp-stat" key={s.key}>
                <span className="kp-stat-v">{s.juve}</span>
                <div className="kp-stat-mid">
                  <span className="kp-stat-label">{s.label}</span>
                  <div className="kp-stat-bar">
                    <i style={{ width: `${share}%` }} />
                  </div>
                </div>
                <span className="kp-stat-v">{s.opp}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="kp-detail-foot">
        <span className="kp-muted">
          {[
            d?.venue || m.venue,
            d?.referee ? `Wasit: ${d.referee}` : '',
            d?.attendance ? `${d.attendance.toLocaleString('id-ID')} penonton` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <a href={`https://www.espn.com/soccer/team-stats/_/gameId/${m.id}`} target="_blank" rel="noreferrer">
          Buka di ESPN ↗
        </a>
      </div>
    </div>
  );
}

/* ---------- jadwal & hasil Juventus ---------- */

export function ScheduleCard({
  title = 'Jadwal Juventus',
  subtitle,
  upcoming,
  past,
  loading,
  error,
  standings = [],
  filterOptions,
  upcomingLimit = 10,
  pastPageSize = 5,
}: {
  title?: string;
  subtitle?: string;
  upcoming: Match[];
  past: Match[];
  loading: boolean;
  error: boolean;
  standings?: Team[];
  /** Kalau diisi, tampilkan dropdown filter kompetisi. */
  filterOptions?: { value: string; label: string }[];
  upcomingLimit?: number;
  pastPageSize?: number;
}) {
  const [filter, setFilter] = useState('all');
  const [pastPage, setPastPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [sharedId, setSharedId] = useState<string | null>(null);

  const ok = (m: Match) => filter === 'all' || m.league === filter;
  const upShown = upcoming.filter(ok).slice(0, upcomingLimit);
  const pastAll = past.filter(ok);
  const pastShown = pastAll.slice(pastPage * pastPageSize, (pastPage + 1) * pastPageSize);

  const juve = standings.find((t) => t.name.includes('Juventus'));
  const noteFor = (m: Match) => {
    const opp = standings.find((t) => t.id === m.opponentId);
    if (m.league === 'ita.1' && juve && opp && juve.position <= 2 && opp.position <= 2) return 'Duel puncak klasemen';
    return DERBY[m.opponent] || '';
  };

  async function toggleDetail(m: Match) {
    if (openId === m.id) return setOpenId(null);
    setOpenId(m.id);
    if (details[m.id] && !details[m.id].error) return;
    setDetails((p) => ({ ...p, [m.id]: { loading: true } }));
    try {
      const res = await fetch(`/api/match/${m.id}?league=${encodeURIComponent(m.league)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error('detail');
      setDetails((p) => ({ ...p, [m.id]: { loading: false, ...data } }));
    } catch {
      setDetails((p) => ({ ...p, [m.id]: { loading: false, error: true } }));
    }
  }

  async function share(m: Match) {
    const text = `Juventus ${m.juveScore}–${m.opponentScore} ${m.opponent} · ${m.competition}`;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) await navigator.share({ title: text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setSharedId(m.id);
        setTimeout(() => setSharedId(null), 1800);
      }
    } catch {
      /* dibatalkan pengguna */
    }
  }

  return (
    <section className="kp-card">
      <header className="kp-card-head">
        <h2 className="kp-title">{title}</h2>
        <small className="kp-muted">{subtitle ?? `${upcomingLimit} laga ke depan`}</small>
      </header>

      {filterOptions && (
        <div className="kp-filter">
          <CompSelect
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPastPage(0);
            }}
            options={filterOptions}
          />
        </div>
      )}

      <div className="kp-group">Mendatang</div>
      {loading ? (
        <div className="kp-empty">Memuat jadwal…</div>
      ) : error ? (
        <div className="kp-empty">Jadwal belum bisa dimuat dari ESPN. Coba muat ulang halaman.</div>
      ) : upShown.length === 0 ? (
        <div className="kp-empty">Belum ada jadwal mendatang.</div>
      ) : (
        upShown.map((m) => {
          const note = noteFor(m);
          return (
            <div className="kp-fixture" key={m.id}>
              <div className="kp-when">
                <strong>{m.dateLabel}</strong>
                <span>{m.dayTime}</span>
              </div>
              <div className="kp-opp">
                <span className={`kp-venue ${m.isHome ? 'home' : 'away'}`}>{m.venueText}</span>
                <div className="kp-opp-name">
                  {m.opponentLogo && <img src={m.opponentLogo} alt="" className="kp-logo" />}
                  {m.opponent}
                </div>
                <span className="kp-note">
                  {m.competition}
                  {m.week ? ` · Pekan ${m.week}` : ''}
                  {note ? ` · ${note}` : ''}
                </span>
              </div>
              <div className="kp-actions">
                <a className="kp-btn kp-btn-red" href="https://www.vidio.com" target="_blank" rel="noreferrer">
                  <span className="kp-play" aria-hidden>▶</span> Vidio · SCTV*
                </a>
                <a className="kp-btn" href={calendarUrl(m)} target="_blank" rel="noreferrer">
                  + Kalender
                </a>
              </div>
            </div>
          );
        })
      )}

      <div className="kp-group">Hasil</div>
      {loading ? (
        <div className="kp-empty">Memuat hasil…</div>
      ) : error ? (
        <div className="kp-empty">Hasil belum bisa dimuat dari ESPN.</div>
      ) : pastShown.length === 0 ? (
        <div className="kp-empty">Belum ada hasil pertandingan.</div>
      ) : (
        pastShown.map((m) => (
          <div className="kp-result" key={m.id}>
            <div className="kp-when">
              <strong>{m.dateLabel}</strong>
              <span>{m.dayTime}</span>
            </div>
            <div className="kp-result-body">
              <div className="kp-result-top">
                <div className="kp-opp-name">
                  {m.opponentLogo && <img src={m.opponentLogo} alt="" className="kp-logo" />}
                  {m.opponent}
                  <span className={`kp-venue ${m.isHome ? 'home' : 'away'}`}>{m.venueText}</span>
                  <span className="kp-week">
                    {m.competition}
                    {m.week ? ` · Pekan ${m.week}` : ''}
                  </span>
                </div>
                <div className="kp-score">
                  {m.juveScore}-{m.opponentScore}
                  <span className={`kp-fb kp-fb-${m.result}`}>{FORM_LABEL[m.result as Letter]}</span>
                </div>
              </div>

              <div className="kp-scorers">
                {m.events.length ? (
                  m.events.map((s, i) => (
                    <span key={i} className={`kp-scorer ${s.side}`}>
                      <i className={s.kind === 'red' ? 'kp-red-card' : 'kp-ball'} />
                      <em className="kp-ev-team">{s.side === 'juve' ? 'JUV' : m.opponentAbbr}</em>
                      {s.name} {s.minute}
                      {s.tag ? ` (${s.tag})` : ''}
                    </span>
                  ))
                ) : m.juveScore === 0 && m.opponentScore === 0 ? (
                  <span className="kp-muted">Tanpa gol</span>
                ) : null}
              </div>

              <div className="kp-result-actions">
                <a className="kp-mini kp-mini-red" href="https://www.vidio.com" target="_blank" rel="noreferrer" aria-label="Tonton cuplikan">
                  ▶
                </a>
                <button className="kp-mini kp-mini-gold" disabled title="Segera hadir">
                  ★ Rating
                </button>
                <button className="kp-mini kp-mini-share" onClick={() => share(m)}>
                  {sharedId === m.id ? '✓ Disalin' : '↗ Bagikan'}
                </button>
                <button className="kp-mini" aria-expanded={openId === m.id} onClick={() => toggleDetail(m)}>
                  Detail {openId === m.id ? '▴' : '▾'}
                </button>
              </div>

              {openId === m.id && <MatchDetail m={m} d={details[m.id]} />}
            </div>
          </div>
        ))
      )}
      {pastAll.length > pastPageSize && (
        <Pager page={pastPage} pageSize={pastPageSize} total={pastAll.length} onChange={setPastPage} />
      )}
    </section>
  );
}

/* ---------- pertandingan seluruh kompetisi ---------- */

function SimpleRow({ m }: { m: SimpleMatch }) {
  const mid = m.status === 'pre' ? 'v' : `${m.home.score}-${m.away.score}`;
  return (
    <div className={`kp-sm${m.involvesJuve ? ' me' : ''}`}>
      <div className="kp-when">
        <strong>{m.dateLabel}</strong>
        <span>{m.dayTime}</span>
      </div>
      <div className="kp-sm-teams">
        <span className="kp-sm-team home">
          {m.home.name}
          {m.home.logo && <img src={m.home.logo} alt="" className="kp-logo" />}
        </span>
        <b className={`kp-sm-score${m.status === 'pre' ? ' pre' : ''}`}>{mid}</b>
        <span className="kp-sm-team">
          {m.away.logo && <img src={m.away.logo} alt="" className="kp-logo" />}
          {m.away.name}
        </span>
      </div>
      {m.round && <div className="kp-sm-round">{m.round}</div>}
    </div>
  );
}

export function MatchesCard({
  title,
  subtitle,
  matches,
  loading,
  error,
  variant,
}: {
  title: string;
  subtitle?: string;
  matches: SimpleMatch[];
  loading: boolean;
  error: boolean;
  /** 'all' = semua pertandingan per bulan; 'others' = tanpa Juventus (hasil terbaru + mendatang) */
  variant: 'all' | 'others';
}) {
  const groups = useMemo(() => {
    if (variant === 'others') {
      const rest = matches.filter((m) => !m.involvesJuve);
      const done = rest.filter((m) => m.status === 'post').slice(-12).reverse();
      const next = rest.filter((m) => m.status !== 'post').slice(0, 12);
      return [
        { label: 'Hasil terbaru', items: done },
        { label: 'Mendatang', items: next },
      ];
    }
    const map = new Map<string, SimpleMatch[]>();
    matches.forEach((m) => {
      const k = m.month;
      map.set(k, [...(map.get(k) ?? []), m]);
    });
    return Array.from(map, ([label, items]) => ({ label, items }));
  }, [matches, variant]);

  return (
    <section className="kp-card">
      <header className="kp-card-head">
        <h2 className="kp-title">{title}</h2>
        <small className="kp-muted">{subtitle}</small>
      </header>
      {loading ? (
        <div className="kp-empty">Memuat pertandingan…</div>
      ) : error || matches.length === 0 ? (
        <div className="kp-empty">Pertandingan belum bisa dimuat dari ESPN.</div>
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            <div className="kp-group">{g.label}</div>
            {g.items.length === 0 ? (
              <div className="kp-empty">Belum ada data.</div>
            ) : (
              g.items.map((m) => <SimpleRow key={m.id} m={m} />)
            )}
          </div>
        ))
      )}
    </section>
  );
}

/* ---------- top skor / statistik pemain ---------- */

export function ScorersCard({
  title,
  subtitle,
  players,
  loading,
  error,
  cards = false,
  limit = 20,
}: {
  title: string;
  subtitle?: string;
  players: PlayerStat[];
  loading: boolean;
  error: boolean;
  cards?: boolean;
  limit?: number;
}) {
  const list = (cards ? players : players.filter((p) => p.goals > 0)).slice(0, limit);
  return (
    <section className="kp-card">
      <header className="kp-card-head">
        <h2 className="kp-title">{title}</h2>
        <small className="kp-muted">{subtitle}</small>
      </header>
      {loading ? (
        <div className="kp-empty">Memuat statistik…</div>
      ) : error || list.length === 0 ? (
        <div className="kp-empty">Belum ada data pemain dari ESPN.</div>
      ) : (
        <div className="kp-table-wrap">
          <table className="kp-table kp-table-players">
            <thead>
              <tr>
                <th className="c-pos">#</th>
                <th className="c-club">Pemain</th>
                {!cards && <th className="c-club">Klub</th>}
                <th>Gol</th>
                <th>Pen</th>
                {cards && <th>Kuning</th>}
                {cards && <th>Merah</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={`${p.id}-${p.teamId}`} className={p.team.includes('Juventus') ? 'me' : ''}>
                  <td className="c-pos">{i + 1}</td>
                  <td className="c-club">
                    <span className="kp-club-name">{p.name}</span>
                  </td>
                  {!cards && <td className="c-club kp-muted">{p.team}</td>}
                  <td className="c-pts">{p.goals}</td>
                  <td>{p.pens}</td>
                  {cards && <td>{p.yellow}</td>}
                  {cards && <td>{p.red}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
