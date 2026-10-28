'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CompSelect,
  EUROPA_ZONES,
  FORM_LABEL,
  FormBadges,
  JUVE_LOGO,
  SERIE_A_ZONES,
  ScorersCard,
  StandingsCard,
  calendarUrl,
  monthOf,
  useFetch,
} from '@/components/kp';
import type { Athlete, Letter, Match, PlayerStat, Team } from '@/lib/types';

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'jadwal', label: 'Jadwal' },
  { key: 'hasil', label: 'Hasil' },
  { key: 'skuad', label: 'Skuad' },
  { key: 'statistik', label: 'Statistik' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'klasemen', label: 'Klasemen' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const COMP_OPTIONS = [
  { value: 'ita.1', label: 'Serie A' },
  { value: 'uefa.europa', label: 'Liga Europa' },
  { value: 'ita.coppa_italia', label: 'Coppa Italia' },
];

const GROUP_ORDER: Athlete['group'][] = ['Kiper', 'Bek', 'Gelandang', 'Penyerang', 'Lainnya'];

function MatchTable({ matches, mode }: { matches: Match[]; mode: 'fixtures' | 'results' }) {
  const groups = useMemo(() => {
    const map = new Map<string, Match[]>();
    matches.forEach((m) => {
      const k = monthOf(m.iso);
      map.set(k, [...(map.get(k) ?? []), m]);
    });
    return Array.from(map, ([label, items]) => ({ label, items }));
  }, [matches]);

  if (!matches.length) return <div className="kp-empty">Tidak ada pertandingan.</div>;

  return (
    <>
      {groups.map((g) => (
        <div key={g.label} className="kp-mt-group">
          <h3 className="kp-mt-month">{g.label}</h3>
          <div className="kp-table-wrap">
            <table className="kp-mt">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Pertandingan</th>
                  <th>{mode === 'fixtures' ? 'Waktu (WIB)' : 'Skor'}</th>
                  <th>Kompetisi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {g.items.map((m) => {
                  const home = m.isHome
                    ? { name: 'Juventus', logo: JUVE_LOGO }
                    : { name: m.opponent, logo: m.opponentLogo };
                  const away = m.isHome
                    ? { name: m.opponent, logo: m.opponentLogo }
                    : { name: 'Juventus', logo: JUVE_LOGO };
                  const score = m.isHome ? `${m.juveScore}-${m.opponentScore}` : `${m.opponentScore}-${m.juveScore}`;
                  return (
                    <tr key={m.id}>
                      <td className="kp-muted">
                        {m.dateLabel} <span>· {m.dayTime.split(' · ')[0]}</span>
                      </td>
                      <td>
                        <div className="kp-mt-match">
                          <b className={home.name === 'Juventus' ? 'me' : ''}>{home.name}</b>
                          {home.logo && <img src={home.logo} alt="" className="kp-logo" />}
                          <span className="kp-muted">v</span>
                          {away.logo && <img src={away.logo} alt="" className="kp-logo" />}
                          <b className={away.name === 'Juventus' ? 'me' : ''}>{away.name}</b>
                        </div>
                      </td>
                      <td>
                        {mode === 'fixtures' ? (
                          m.dayTime.split(' · ')[1]
                        ) : (
                          <span className="kp-score kp-score-sm">
                            {score}
                            <span className={`kp-fb kp-fb-${m.result}`}>{FORM_LABEL[m.result as Letter]}</span>
                          </span>
                        )}
                      </td>
                      <td className="kp-muted">
                        {m.competition}
                        {m.week ? ` · Pekan ${m.week}` : ''}
                      </td>
                      <td>
                        {mode === 'fixtures' ? (
                          <a className="kp-btn" href={calendarUrl(m)} target="_blank" rel="noreferrer">
                            + Kalender
                          </a>
                        ) : (
                          <a
                            className="kp-btn"
                            href={`https://www.espn.com/soccer/match/_/gameId/${m.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Detail ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

function JuventusInner() {
  const params = useSearchParams();
  const tabParam = params.get('tab') as TabKey | null;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : 'ringkasan';

  const [filter, setFilter] = useState('all');
  const [statsLeague, setStatsLeague] = useState('all');
  const [tableLeague, setTableLeague] = useState('ita.1');

  const juveRes = useFetch<{ upcoming: Match[]; past: Match[] }>('/api/juventus');
  const squadRes = useFetch<{ players: Athlete[]; coach: string }>(tab === 'skuad' ? '/api/squad' : null);
  const statsRes = useFetch<{ players: PlayerStat[] }>(
    tab === 'statistik' || tab === 'ringkasan'
      ? `/api/juventus/stats${tab === 'statistik' && statsLeague !== 'all' ? `?league=${statsLeague}` : ''}`
      : null
  );
  const tableRes = useFetch<{ standings: Team[]; week: number }>(
    tab === 'klasemen' ? `/api/standings?league=${tableLeague}` : null
  );

  const upcoming = juveRes.data?.upcoming ?? [];
  const past = juveRes.data?.past ?? [];
  const byComp = <T extends { league: string }>(list: T[]) => (filter === 'all' ? list : list.filter((m) => m.league === filter));

  const next = upcoming[0];
  const last = past[0];
  const form = past
    .slice(0, 5)
    .map((m) => m.result as Letter)
    .reverse();

  const grouped = useMemo(() => {
    const players = squadRes.data?.players ?? [];
    return GROUP_ORDER.map((g) => ({ g, items: players.filter((p) => p.group === g) })).filter((x) => x.items.length);
  }, [squadRes.data]);

  return (
    <div className="kp">
      <header className="kp-team-head">
        <img src={JUVE_LOGO} alt="" className="kp-team-logo" />
        <div>
          <h1 className="kp-team-name">Juventus</h1>
          <span className="kp-muted">Serie A · Liga Europa · Coppa Italia · data ESPN</span>
        </div>
      </header>

      <div className="kp-tabs" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            href={`/juventus?tab=${t.key}`}
            scroll={false}
            className={`kp-tab${tab === t.key ? ' active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* RINGKASAN */}
      {tab === 'ringkasan' && (
        <div className="kp-grid kp-grid-even">
          <section className="kp-card">
            <header className="kp-card-head">
              <h2 className="kp-title">Laga berikutnya</h2>
            </header>
            {juveRes.loading ? (
              <div className="kp-empty">Memuat…</div>
            ) : !next ? (
              <div className="kp-empty">Belum ada jadwal mendatang.</div>
            ) : (
              <div className="kp-hero">
                <div className="kp-muted">
                  {next.competition}
                  {next.week ? ` · Pekan ${next.week}` : ''}
                </div>
                <div className="kp-hero-teams">
                  <span>
                    <img src={next.isHome ? JUVE_LOGO : next.opponentLogo} alt="" className="kp-logo-lg" />
                    {next.isHome ? 'Juventus' : next.opponent}
                  </span>
                  <b>v</b>
                  <span>
                    <img src={next.isHome ? next.opponentLogo : JUVE_LOGO} alt="" className="kp-logo-lg" />
                    {next.isHome ? next.opponent : 'Juventus'}
                  </span>
                </div>
                <div className="kp-hero-when">
                  {next.dateLabel} · {next.dayTime.split(' · ')[1]} WIB
                </div>
                <div className="kp-muted">{next.venue}</div>
                <a className="kp-btn" href={calendarUrl(next)} target="_blank" rel="noreferrer">
                  + Kalender
                </a>
              </div>
            )}
          </section>

          <section className="kp-card">
            <header className="kp-card-head">
              <h2 className="kp-title">Hasil terakhir</h2>
            </header>
            {juveRes.loading ? (
              <div className="kp-empty">Memuat…</div>
            ) : !last ? (
              <div className="kp-empty">Belum ada hasil.</div>
            ) : (
              <div className="kp-hero">
                <div className="kp-muted">
                  {last.competition}
                  {last.week ? ` · Pekan ${last.week}` : ''} · {last.dateLabel}
                </div>
                <div className="kp-hero-teams">
                  <span>
                    <img src={last.isHome ? JUVE_LOGO : last.opponentLogo} alt="" className="kp-logo-lg" />
                    {last.isHome ? 'Juventus' : last.opponent}
                  </span>
                  <b className="kp-hero-score">
                    {last.isHome ? last.juveScore : last.opponentScore}-{last.isHome ? last.opponentScore : last.juveScore}
                  </b>
                  <span>
                    <img src={last.isHome ? last.opponentLogo : JUVE_LOGO} alt="" className="kp-logo-lg" />
                    {last.isHome ? last.opponent : 'Juventus'}
                  </span>
                </div>
                <div className="kp-scorers" style={{ justifyContent: 'center' }}>
                  {last.events.map((s, i) => (
                    <span key={i} className={`kp-scorer ${s.side}`}>
                      <i className={s.kind === 'red' ? 'kp-red-card' : 'kp-ball'} />
                      {s.name} {s.minute}
                      {s.tag ? ` (${s.tag})` : ''}
                    </span>
                  ))}
                </div>
                <div>
                  <div className="kp-metric-hint">Form 5 laga · lama → terbaru</div>
                  <FormBadges form={form} />
                </div>
              </div>
            )}
          </section>

          <ScorersCard
            title="Pencetak gol"
            subtitle="Semua kompetisi"
            players={statsRes.data?.players ?? []}
            loading={statsRes.loading}
            error={statsRes.error}
            limit={5}
          />
        </div>
      )}

      {/* JADWAL / HASIL */}
      {(tab === 'jadwal' || tab === 'hasil') && (
        <section className="kp-card">
          <header className="kp-card-head">
            <h2 className="kp-title">{tab === 'jadwal' ? 'Jadwal Juventus' : 'Hasil Juventus'}</h2>
            <CompSelect value={filter} onChange={setFilter} options={COMP_OPTIONS} />
          </header>
          {juveRes.loading ? (
            <div className="kp-empty">Memuat…</div>
          ) : juveRes.error ? (
            <div className="kp-empty">Data belum bisa dimuat dari ESPN. Coba muat ulang halaman.</div>
          ) : (
            <MatchTable
              mode={tab === 'jadwal' ? 'fixtures' : 'results'}
              matches={byComp(tab === 'jadwal' ? upcoming : past)}
            />
          )}
        </section>
      )}

      {/* SKUAD */}
      {tab === 'skuad' && (
        <section className="kp-card" id="skuad">
          <header className="kp-card-head">
            <h2 className="kp-title">Skuad</h2>
            <small className="kp-muted">{squadRes.data?.coach ? `Pelatih: ${squadRes.data.coach}` : 'data ESPN'}</small>
          </header>
          {squadRes.loading ? (
            <div className="kp-empty">Memuat skuad…</div>
          ) : squadRes.error || !grouped.length ? (
            <div className="kp-empty">Skuad belum bisa dimuat dari ESPN.</div>
          ) : (
            grouped.map(({ g, items }) => (
              <div key={g}>
                <div className="kp-group">{g}</div>
                <div className="kp-squad">
                  {items.map((p) => (
                    <div className="kp-player" key={p.id}>
                      <span className="kp-jersey">{p.jersey || '–'}</span>
                      <div>
                        <b>{p.name}</b>
                        <div className="kp-muted">
                          {[p.position, p.age ? `${p.age} th` : '', p.nation].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* STATISTIK */}
      {tab === 'statistik' && (
        <div id="statistik">
          <div className="kp-filter kp-filter-top">
            <CompSelect value={statsLeague} onChange={setStatsLeague} options={COMP_OPTIONS} />
          </div>
          <ScorersCard
            title="Gol & kartu"
            subtitle="Dihitung dari kejadian tiap pertandingan · assist dan jumlah main belum tersedia"
            players={statsRes.data?.players ?? []}
            loading={statsRes.loading}
            error={statsRes.error}
            cards
            limit={40}
          />
        </div>
      )}

      {/* TRANSFER */}
      {tab === 'transfer' && (
        <section className="kp-card">
          <header className="kp-card-head">
            <h2 className="kp-title">Transfer</h2>
          </header>
          <div className="kp-empty">
            ESPN tidak menyediakan data transfer lewat API yang bisa dipakai di sini.
            <div style={{ marginTop: 12 }}>
              <a
                className="kp-btn kp-btn-red"
                href="https://www.espn.com/soccer/team/transfers/_/id/111/juventus"
                target="_blank"
                rel="noreferrer"
              >
                Lihat transfer Juventus di ESPN ↗
              </a>
            </div>
          </div>
        </section>
      )}

      {/* KLASEMEN */}
      {tab === 'klasemen' && (
        <>
          <div className="kp-filter kp-filter-top">
            <CompSelect
              value={tableLeague}
              onChange={setTableLeague}
              options={COMP_OPTIONS.slice(0, 2)}
              allLabel={null}
            />
          </div>
          <StandingsCard
            subtitle={tableRes.data?.week ? `Setelah pekan ${tableRes.data.week} · data ESPN` : 'data ESPN'}
            standings={tableRes.data?.standings ?? []}
            loading={tableRes.loading}
            error={tableRes.error}
            zones={tableLeague === 'uefa.europa' ? EUROPA_ZONES : SERIE_A_ZONES}
          />
        </>
      )}
    </div>
  );
}

export default function JuventusPage() {
  return (
    <Suspense fallback={<div className="kp kp-empty">Memuat…</div>}>
      <JuventusInner />
    </Suspense>
  );
}
