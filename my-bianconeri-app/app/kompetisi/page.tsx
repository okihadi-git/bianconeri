'use client';

import { useEffect, useMemo, useState } from 'react';

type Letter = 'W' | 'D' | 'L';

interface Team {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  position: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: Letter[];
}

interface Match {
  id: string;
  week: number;
  iso: string;
  dateLabel: string;
  dayTime: string;
  opponentId: string;
  opponent: string;
  opponentLogo: string;
  isHome: boolean;
  venueText: string;
  venue: string;
  juveScore: number;
  opponentScore: number;
  result: Letter | null;
  scorers: { name: string; minute: string; tag: string }[];
}

const COMPETITIONS = [
  { key: 'seriea', icon: '🇮🇹', label: 'Serie A' },
  { key: 'ucl', icon: '🇪🇺', label: 'Liga Champions' },
  { key: 'coppa', icon: '🏆', label: 'Coppa Italia' },
  { key: 'supercoppa', icon: '🛡️', label: 'Supercoppa Italiana' },
  { key: 'tour', icon: '✈️', label: 'Pramusim & Tur' },
] as const;

const SUB_TABS = [
  { key: 'klasemen', label: 'Klasemen & jadwal' },
  { key: 'lagalain', label: 'Laga lain' },
  { key: 'topskor', label: 'Top skor' },
  { key: 'trofi', label: 'Jalan ke trofi' },
  { key: 'peluang', label: 'Peluang juara' },
  { key: 'gelar', label: 'Perebutan gelar' },
  { key: 'laju', label: 'Laju poin' },
] as const;

const FORM_LABEL: Record<Letter, string> = { W: 'M', D: 'S', L: 'K' };
const RESULT_WORD: Record<Letter, string> = { W: 'menang', D: 'seri', L: 'kalah' };
const DERBY: Record<string, string> = {
  Torino: 'Derby della Mole',
  'Inter Milan': "Derby d'Italia",
};

const UPCOMING_PAGE_SIZE = 7;
const PAST_PAGE_SIZE = 5;

const fmtDecimal = (n: number) => n.toFixed(1).replace('.', ',');
const fmtSigned = (n: number) => (n > 0 ? `+${n}` : String(n));
const zoneOf = (pos: number) => (pos <= 4 ? 'ucl' : pos === 5 ? 'uel' : pos >= 18 ? 'rel' : '');

function calendarUrl(m: Match) {
  const start = new Date(m.iso);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const title = m.isHome ? `Juventus vs ${m.opponent}` : `${m.opponent} vs Juventus`;
  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${f(start)}/${f(end)}` +
    `&details=${encodeURIComponent(`Serie A · Pekan ${m.week}`)}` +
    `&location=${encodeURIComponent(m.venue)}`
  );
}

function FormBadges({ form }: { form: Letter[] }) {
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

function Pager({
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

export default function KompetisiPage() {
  const [comp, setComp] = useState<(typeof COMPETITIONS)[number]['key']>('seriea');
  const [tab, setTab] = useState<(typeof SUB_TABS)[number]['key']>('klasemen');

  const [standings, setStandings] = useState<Team[]>([]);
  const [week, setWeek] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<{ upcoming: Match[]; past: Match[] }>({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [upPage, setUpPage] = useState(0);
  const [pastPage, setPastPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [resStandings, resJuve] = await Promise.all([fetch('/api/standings'), fetch('/api/juventus')]);
        const dataStandings = await resStandings.json();
        const dataJuve = await resJuve.json();

        setStandings(dataStandings.standings || []);
        setWeek(dataStandings.week || 0);
        setUpdatedAt(dataStandings.updatedAt || null);
        setSchedule({ upcoming: dataJuve.upcoming || [], past: dataJuve.past || [] });
        if (!dataStandings.standings && !dataJuve.upcoming) setError(true);
      } catch (err) {
        console.error('Gagal mengambil data:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const juve = standings.find((t) => t.name.includes('Juventus'));
  const leader = standings[0];
  const pointsBehind = leader && juve ? leader.points - juve.points : 0;
  const lastMatch = schedule.past[0];

  const updatedLabel = useMemo(() => {
    if (!updatedAt) return null;
    return new Date(updatedAt).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    });
  }, [updatedAt]);

  const upcomingShown = schedule.upcoming.slice(upPage * UPCOMING_PAGE_SIZE, (upPage + 1) * UPCOMING_PAGE_SIZE);
  const pastShown = schedule.past.slice(pastPage * PAST_PAGE_SIZE, (pastPage + 1) * PAST_PAGE_SIZE);
  const weekRange = upcomingShown.length
    ? `Pekan ${upcomingShown[0].week}–${upcomingShown[upcomingShown.length - 1].week}`
    : '';

  const noteFor = (m: Match) => {
    const opp = standings.find((t) => t.id === m.opponentId);
    if (juve && opp && juve.position <= 2 && opp.position <= 2) return 'Duel puncak klasemen';
    return DERBY[m.opponent] || '';
  };

  async function share(m: Match) {
    const text = `Juventus ${m.juveScore}–${m.opponentScore} ${m.opponent} · Serie A Pekan ${m.week}`;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ title: text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setSharedId(m.id);
        setTimeout(() => setSharedId(null), 1800);
      }
    } catch {
      /* dibatalkan pengguna */
    }
  }

  return (
    <div className="kp">
      {/* Kompetisi */}
      <div className="kp-comps">
        {COMPETITIONS.map((c) => (
          <button
            key={c.key}
            className={`kp-comp${comp === c.key ? ' active' : ''}`}
            onClick={() => setComp(c.key)}
          >
            <span aria-hidden>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      {/* Ringkasan */}
      <div className="kp-metrics">
        <div className="kp-metric kp-metric-purple">
          <div className="kp-metric-label">Posisi</div>
          <div className="kp-metric-val">#{juve ? juve.position : '–'}</div>
          <div className="kp-metric-sub">
            {!juve
              ? 'Memuat data…'
              : juve.position === 1
              ? 'Memimpin klasemen'
              : `${pointsBehind} poin di belakang ${leader?.name}`}
          </div>
        </div>

        <div className="kp-metric">
          <div className="kp-metric-label">Poin</div>
          <div className="kp-metric-val">{juve ? juve.points : '–'}</div>
          <div className="kp-metric-sub">
            {juve ? `${juve.won}M · ${juve.draw}S · ${juve.lost}K dari ${juve.playedGames} laga` : 'Memuat data…'}
          </div>
        </div>

        <div className="kp-metric">
          <div className="kp-metric-label">Gol</div>
          <div className="kp-metric-val">{juve ? `${juve.goalsFor}-${juve.goalsAgainst}` : '–'}</div>
          <div className="kp-metric-sub">
            {juve
              ? `Selisih ${fmtSigned(juve.goalDifference)} · ${fmtDecimal(juve.goalsFor / (juve.playedGames || 1))} gol per laga`
              : 'Memuat data…'}
          </div>
        </div>

        <div className="kp-metric">
          <div className="kp-metric-label">Form 5 laga</div>
          <div className="kp-metric-hint">lama → terbaru</div>
          <FormBadges form={juve?.form ?? []} />
          <div className="kp-metric-sub">
            {lastMatch
              ? `Terakhir: ${RESULT_WORD[lastMatch.result as Letter]} ${lastMatch.juveScore}–${lastMatch.opponentScore} vs ${lastMatch.opponent}`
              : 'Memuat data…'}
          </div>
        </div>
      </div>

      {/* Sub tab */}
      <div className="kp-tabs" role="tablist">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`kp-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(comp !== 'seriea' || tab !== 'klasemen') && (
        <div className="kp-card kp-empty">
          Bagian ini belum tersedia. Data lengkapnya baru ada untuk Serie A › Klasemen &amp; jadwal.
        </div>
      )}

      {comp === 'seriea' && tab === 'klasemen' && (
        <div className="kp-grid">
          {/* KLASEMEN */}
          <section className="kp-card">
            <header className="kp-card-head">
              <h2 className="kp-title">Klasemen</h2>
              <small className="kp-muted">
                {week ? `Setelah pekan ${week}` : ''}
                {updatedLabel ? ` · diperbarui otomatis ${updatedLabel}` : ''} · data ESPN
              </small>
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
                      <th>GM</th>
                      <th>GK</th>
                      <th>SG</th>
                      <th>Poin</th>
                      <th className="c-form">5 laga terakhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((t) => {
                      const isJuve = t.id === juve?.id;
                      const zone = zoneOf(t.position);
                      return (
                        <tr key={t.id} className={`${zone ? `zone-${zone}` : ''}${isJuve ? ' me' : ''}`}>
                          <td className="c-pos">{t.position}</td>
                          <td className="c-club">
                            <span className="kp-abbr">{t.shortName}</span>
                            {t.logo && <img src={t.logo} alt="" className="kp-logo" />}
                            <span className="kp-club-name">{t.name}</span>
                          </td>
                          <td>{t.playedGames}</td>
                          <td>{t.won}</td>
                          <td>{t.draw}</td>
                          <td>{t.lost}</td>
                          <td>{t.goalsFor}</td>
                          <td>{t.goalsAgainst}</td>
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
              <span><i className="lg lg-ucl" /> Liga Champions (1–4)</span>
              <span><i className="lg lg-uel" /> Liga Europa (5)</span>
              <span><i className="lg lg-rel" /> Degradasi (18–20)</span>
              <span className="kp-legend-note">M menang · S seri · K kalah · kanan = laga terbaru</span>
            </footer>
          </section>

          {/* JADWAL LIGA */}
          <section className="kp-card">
            <header className="kp-card-head">
              <h2 className="kp-title">Jadwal liga</h2>
              <small className="kp-muted">{weekRange}</small>
            </header>

            <div className="kp-group">Mendatang</div>
            {loading ? (
              <div className="kp-empty">Memuat jadwal…</div>
            ) : upcomingShown.length === 0 ? (
              <div className="kp-empty">Belum ada jadwal mendatang.</div>
            ) : (
              upcomingShown.map((m) => {
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
                      {note && <span className="kp-note">{note}</span>}
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
            <Pager page={upPage} pageSize={UPCOMING_PAGE_SIZE} total={schedule.upcoming.length} onChange={setUpPage} />

            <div className="kp-group">Hasil</div>
            {loading ? (
              <div className="kp-empty">Memuat hasil…</div>
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
                        <span className="kp-week">Pekan {m.week}</span>
                      </div>
                      <div className="kp-score">
                        {m.juveScore}-{m.opponentScore}
                        <span className={`kp-fb kp-fb-${m.result}`}>{FORM_LABEL[m.result as Letter]}</span>
                      </div>
                    </div>

                    <div className="kp-scorers">
                      {m.scorers.length ? (
                        m.scorers.map((s, i) => (
                          <span key={i} className="kp-scorer">
                            <i className="kp-ball" />
                            {s.name} {s.minute}
                            {s.tag ? ` (${s.tag})` : ''}
                          </span>
                        ))
                      ) : m.juveScore === 0 ? (
                        <span className="kp-muted">Tidak ada gol Juventus</span>
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
                      <button
                        className="kp-mini"
                        aria-expanded={openId === m.id}
                        onClick={() => setOpenId(openId === m.id ? null : m.id)}
                      >
                        Detail {openId === m.id ? '▴' : '▾'}
                      </button>
                    </div>

                    {openId === m.id && (
                      <div className="kp-detail">
                        {m.venue ? `${m.venue} · ` : ''}Serie A pekan {m.week}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <Pager page={pastPage} pageSize={PAST_PAGE_SIZE} total={schedule.past.length} onChange={setPastPage} />
          </section>
        </div>
      )}
    </div>
  );
}
