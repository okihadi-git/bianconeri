'use client';

import { useMemo, useState } from 'react';
import { JUVE_LOGO, useFetch } from '@/components/kp';
import type { PlayerRow, PlayerStatsResponse, PosGroup } from '@/lib/playerstats';

const COMP_LABEL: [string, string][] = [
  ['ita.1', 'Serie A'],
  ['uefa.champions', 'Liga Champions'],
  ['uefa.europa', 'Liga Europa'],
  ['ita.coppa_italia', 'Coppa Italia'],
  ['ita.super_cup', 'Supercoppa'],
];

const GROUPS: (PosGroup | 'all')[] = ['all', 'Penyerang', 'Gelandang', 'Bek', 'Kiper'];

type SortKey = 'played' | 'started' | 'minutes' | 'goals' | 'assists' | 'ga' | 'g90' | 'ga90' | 'shots' | 'onTarget' | 'conv' | 'cards';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'played', label: 'Main' },
  { key: 'started', label: 'Start' },
  { key: 'minutes', label: 'Menit' },
  { key: 'goals', label: 'Gol' },
  { key: 'assists', label: 'Assist' },
  { key: 'ga', label: 'G+A' },
  { key: 'g90', label: 'Gol/90' },
  { key: 'ga90', label: 'G+A/90' },
  { key: 'shots', label: 'Tembakan' },
  { key: 'onTarget', label: 'Tepat' },
  { key: 'conv', label: 'Konversi' },
  { key: 'cards', label: 'Kartu' },
];

interface Row {
  id: string;
  name: string;
  group: PosGroup;
  pos: string;
  played: number;
  started: number;
  minutes: number;
  goals: number;
  assists: number | null;
  ga: number | null;
  g90: number | null;
  ga90: number | null;
  shots: number | null;
  onTarget: number | null;
  conv: number | null;
  yellow: number;
  red: number;
  cards: number;
}

const sumNullable = (list: (number | null)[]) =>
  list.every((v) => v == null) ? null : list.reduce<number>((n, v) => n + (v ?? 0), 0);

function rowFor(p: PlayerRow, leagues: string[]): Row | null {
  const lines = leagues.map((l) => p.by[l]).filter(Boolean);
  if (!lines.length) return null;
  const played = lines.reduce((n, l) => n + l.played, 0);
  if (!played) return null;
  const minutes = lines.reduce((n, l) => n + l.minutes, 0);
  const goals = lines.reduce((n, l) => n + l.goals, 0);
  const assists = sumNullable(lines.map((l) => l.assists));
  const shots = sumNullable(lines.map((l) => l.shots));
  const onTarget = sumNullable(lines.map((l) => l.onTarget));
  const yellow = lines.reduce((n, l) => n + l.yellow, 0);
  const red = lines.reduce((n, l) => n + l.red, 0);
  const ga = assists == null ? null : goals + assists;
  return {
    id: p.id,
    name: p.name,
    group: p.group,
    pos: p.pos,
    played,
    started: lines.reduce((n, l) => n + l.started, 0),
    minutes,
    goals,
    assists,
    ga,
    g90: minutes > 0 ? (goals / minutes) * 90 : null,
    ga90: minutes > 0 && ga != null ? (ga / minutes) * 90 : null,
    shots,
    onTarget,
    conv: shots ? goals / shots : null,
    yellow,
    red,
    cards: yellow + red,
  };
}

const dash = '–';
const int = (v: number | null) => (v == null ? dash : String(v));
const d2 = (v: number | null) => (v == null ? dash : v.toFixed(2).replace('.', ','));
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function StatisticsPage() {
  const res = useFetch<PlayerStatsResponse>('/api/juventus/stats');
  const [league, setLeague] = useState('all');
  const [group, setGroup] = useState<PosGroup | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'ga', dir: -1 });

  const matches = res.data?.matches ?? {};
  const comps = COMP_LABEL.filter(([slug]) => (matches[slug] ?? 0) > 0);
  const totalMatches = comps.reduce((n, [slug]) => n + matches[slug], 0);
  const activeLeagues = league === 'all' ? comps.map(([s]) => s) : [league];
  const matchCount = league === 'all' ? totalMatches : matches[league] ?? 0;

  const rows = useMemo(() => {
    const list = (res.data?.players ?? [])
      .map((p) => rowFor(p, activeLeagues))
      .filter((r): r is Row => r !== null)
      .filter((r) => group === 'all' || r.group === group);
    const val = (r: Row) => r[sort.key] as number | null;
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1; // data kosong selalu di bawah
      if (y == null) return -1;
      return (y - x) * -sort.dir || b.goals - a.goals || b.minutes - a.minutes;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.data, league, group, sort]);

  const clickSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));

  return (
    <main className="kp">
      <header className="kp-team-head">
        <img src={JUVE_LOGO} alt="" className="kp-team-logo" />
        <div>
          <h1 className="kp-team-name">Statistik Juventus</h1>
          <span className="kp-muted">Statistik pemain musim ini · data pertandingan ESPN</span>
        </div>
      </header>

      <div className="st-pills">
        <button className={`st-pill${league === 'all' ? ' active' : ''}`} onClick={() => setLeague('all')}>
          Semua <small>{totalMatches}</small>
        </button>
        {comps.map(([slug, label]) => (
          <button key={slug} className={`st-pill${league === slug ? ' active' : ''}`} onClick={() => setLeague(slug)}>
            {label} <small>{matches[slug]}</small>
          </button>
        ))}
        <span className="kp-muted st-note">
          {league === 'all' ? 'Semua kompetisi' : comps.find(([s]) => s === league)?.[1]} · {matchCount} laga · data live ESPN
        </span>
      </div>

      <section className="kp-card">
        <header className="kp-card-head">
          <h2 className="kp-title">Statistik pemain lengkap</h2>
          <small className="kp-muted">Main, menit, gol, assist, tembakan, konversi, kartu</small>
        </header>

        <div className="st-pills st-pills-inner">
          {GROUPS.map((g) => (
            <button key={g} className={`st-pill st-pill-sm${group === g ? ' active' : ''}`} onClick={() => setGroup(g)}>
              {g === 'all' ? 'Semua posisi' : g}
            </button>
          ))}
        </div>

        {res.loading ? (
          <div className="kp-empty">Memuat statistik…</div>
        ) : res.error ? (
          <div className="kp-empty">Statistik belum bisa dimuat dari ESPN. Coba muat ulang halaman.</div>
        ) : rows.length === 0 ? (
          <div className="kp-empty">Belum ada data pemain untuk filter ini.</div>
        ) : (
          <div className="kp-table-wrap">
            <table className="kp-table st-table">
              <thead>
                <tr>
                  <th className="c-club">Pemain</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key}>
                      <button
                        className={`st-th${sort.key === c.key ? ' active' : ''}`}
                        onClick={() => clickSort(c.key)}
                        aria-label={`Urutkan menurut ${c.label}`}
                      >
                        {c.label}
                        {sort.key === c.key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="c-club">
                      <div className="st-name">
                        <b>{r.name}</b>
                        <span className="kp-muted">
                          {r.group}
                          {r.pos ? ` · ${r.pos}` : ''}
                        </span>
                      </div>
                    </td>
                    <td>{r.played}</td>
                    <td>{r.started}</td>
                    <td>
                      <div className="st-bar">
                        <i>
                          <b style={{ width: `${Math.min(100, (r.minutes / Math.max(1, matchCount * 90)) * 100)}%` }} />
                        </i>
                        {r.minutes}&apos;
                      </div>
                    </td>
                    <td className="st-strong">{r.goals || dash}</td>
                    <td>{r.assists == null ? dash : r.assists || dash}</td>
                    <td className="st-strong">{r.ga == null ? dash : r.ga || dash}</td>
                    <td>{r.g90 ? d2(r.g90) : dash}</td>
                    <td>{r.ga90 ? d2(r.ga90) : dash}</td>
                    <td>{r.shots == null ? dash : r.shots || dash}</td>
                    <td>
                      {r.onTarget == null || !r.shots ? (
                        dash
                      ) : (
                        <div className="st-ontarget">
                          {r.onTarget}
                          <small>{pct(r.onTarget / r.shots)}</small>
                        </div>
                      )}
                    </td>
                    <td>{r.conv == null ? dash : pct(r.conv)}</td>
                    <td>
                      {r.cards ? (
                        <span className="st-cards">
                          {r.yellow > 0 && <span className="st-card st-card-y">{r.yellow}</span>}
                          {r.red > 0 && <span className="st-card st-card-r">{r.red}</span>}
                        </span>
                      ) : (
                        dash
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="st-foot kp-muted">
          Menit dihitung dari pergantian pemain, jadi perkiraan (kartu merah belum dihitung). Rating dan xG tidak tersedia di ESPN.
          Tanda – berarti ESPN tidak melaporkan datanya.
        </p>
      </section>
    </main>
  );
}
