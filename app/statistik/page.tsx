'use client';

import { useMemo, useState } from 'react';
import Face from '@/components/shared/Face';
import { useFetch } from '@/components/shared/kp';
import { findPlayer } from '@/lib/core/names';
import type { MatchRating, PlayedMatch, PlayerRow, PlayerStatsResponse, PosGroup } from '@/lib/pemain/playerstats';
import type { Match, SquadPlayer, SquadResponse } from '@/lib/core/types';
import '@/components/statistik/stathub.css';

/* ---------- konstanta ---------- */

const COMP_LABEL: [string, string][] = [
  ['ita.1', 'Serie A'],
  ['uefa.champions', 'Liga Champions'],
  ['uefa.europa', 'Liga Europa'],
  ['ita.coppa_italia', 'Coppa Italia'],
  ['ita.super_cup', 'Supercoppa'],
];
const COMP_SHORT: Record<string, string> = { 'ita.1': 'Liga', 'uefa.champions': 'UCL', 'uefa.europa': 'UEL', 'ita.coppa_italia': 'Coppa', 'ita.super_cup': 'Super' };
const compName = (slug: string) => COMP_LABEL.find(([s]) => s === slug)?.[1] ?? slug;

const TABS = [
  { key: 'gol', label: 'Gol & pemain' },
  { key: 'rating', label: 'Rating pemain' },
  { key: 'beban', label: 'Beban menit' },
  { key: 'tim', label: 'Statistik tim' },
  { key: 'kartu', label: 'Kartu & skorsing' },
  { key: 'xg', label: 'xG' },
  { key: 'bola', label: 'Bola mati' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const GROUPS: (PosGroup | 'all')[] = ['all', 'Penyerang', 'Gelandang', 'Bek', 'Kiper'];

/* ---------- util ---------- */

const dash = '–';
const dec = (v: number | null, d = 2) => (v == null ? dash : v.toFixed(d).replace('.', ','));
const int = (v: number | null) => (v == null ? dash : String(v));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const sumNullable = (list: (number | null)[]) => (list.every((v) => v == null) ? null : list.reduce<number>((n, v) => n + (v ?? 0), 0));
const rTone = (r: number | null) => (r == null ? 'na' : r >= 7 ? 'hi' : r >= 6 ? 'mid' : 'lo');
const dateShort = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso));

interface Row {
  p: PlayerRow;
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
  /** rating rata-rata (estimasi) di kompetisi terpilih */
  rating: number | null;
}

type SortKey = 'played' | 'started' | 'minutes' | 'goals' | 'assists' | 'ga' | 'g90' | 'ga90' | 'shots' | 'onTarget' | 'conv' | 'rating' | 'cards';

const ratingsIn = (p: PlayerRow, leagues: string[]): MatchRating[] => (p.ratings ?? []).filter((r) => leagues.includes(r.league) && r.rating != null);
const avgOf = (rs: MatchRating[]) => (rs.length ? rs.reduce((n, r) => n + (r.rating as number), 0) / rs.length : null);

function rowFor(p: PlayerRow, leagues: string[]): Row | null {
  const lines = leagues.map((l) => p.by[l]).filter(Boolean);
  const played = lines.reduce((n, l) => n + l.played, 0);
  if (!played) return null;
  const minutes = lines.reduce((n, l) => n + l.minutes, 0);
  const goals = lines.reduce((n, l) => n + l.goals, 0);
  const assists = sumNullable(lines.map((l) => l.assists));
  const shots = sumNullable(lines.map((l) => l.shots));
  const ga = assists == null ? null : goals + assists;
  return {
    p,
    played,
    started: lines.reduce((n, l) => n + l.started, 0),
    minutes,
    goals,
    assists,
    ga,
    g90: minutes > 0 ? (goals / minutes) * 90 : null,
    ga90: minutes > 0 && ga != null ? (ga / minutes) * 90 : null,
    shots,
    onTarget: sumNullable(lines.map((l) => l.onTarget)),
    conv: shots ? goals / shots : null,
    yellow: lines.reduce((n, l) => n + l.yellow, 0),
    red: lines.reduce((n, l) => n + l.red, 0),
    rating: avgOf(ratingsIn(p, leagues)),
  };
}

/* ---------- kartu ringkasan ---------- */

function Tiles({ d }: { d: PlayerStatsResponse }) {
  const team = d.team ?? {};
  const slugs = COMP_LABEL.map(([s]) => s).filter((s) => (d.matches[s] ?? 0) > 0);
  const allLeagues = Object.keys(d.matches);
  const totalMatches = allLeagues.reduce((n, s) => n + d.matches[s], 0);
  const gf = Object.values(team).reduce((n, t) => n + t.gf, 0);
  const ga = Object.values(team).reduce((n, t) => n + t.ga, 0);
  const cs = Object.values(team).reduce((n, t) => n + t.cleanSheets, 0);

  const tops = (pick: (r: Row) => number | null) => {
    const rows = d.players.map((p) => rowFor(p, allLeagues)).filter((r): r is Row => r !== null);
    const best = Math.max(0, ...rows.map((r) => pick(r) ?? 0));
    return { best, names: best > 0 ? rows.filter((r) => pick(r) === best).map((r) => r.p.name.split(' ').slice(1).join(' ') || r.p.name) : [] };
  };
  const g = tops((r) => r.goals);
  const a = tops((r) => r.assists);
  const join = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(' & ')) || dash;

  return (
    <div className="kp-metrics">
      <div className="kp-metric kp-metric-red">
        <div className="kp-metric-label">Gol · semua kompetisi</div>
        <div className="kp-metric-val">{gf}</div>
        <div className="kp-metric-sub">
          {slugs.map((s) => `${COMP_SHORT[s] ?? compName(s)} ${team[s]?.gf ?? 0}`).join(' · ')} · {totalMatches} laga
        </div>
      </div>
      <div className="kp-metric">
        <div className="kp-metric-label">Top skor</div>
        <div className="kp-metric-val">{g.best || dash}</div>
        <div className="kp-metric-sub">{join(g.names)}</div>
      </div>
      <div className="kp-metric">
        <div className="kp-metric-label">Top assist</div>
        <div className="kp-metric-val">{a.best || dash}</div>
        <div className="kp-metric-sub">{join(a.names)}</div>
      </div>
      <div className="kp-metric">
        <div className="kp-metric-label">Clean sheet</div>
        <div className="kp-metric-val">{cs}</div>
        <div className="kp-metric-sub">kebobolan {ga} · {totalMatches ? dec(ga / totalMatches) : dash} per laga</div>
      </div>
    </div>
  );
}

/* ---------- tab: gol & pemain ---------- */

function GolTab({ d, leagues, matchCount, label }: { d: PlayerStatsResponse; leagues: string[]; matchCount: number; label: string }) {
  const [group, setGroup] = useState<PosGroup | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'ga', dir: -1 });

  const rows = useMemo(() => {
    const list = d.players.map((p) => rowFor(p, leagues)).filter((r): r is Row => r !== null).filter((r) => group === 'all' || r.p.group === group);
    const val = (r: Row): number | null => {
      const k = sort.key;
      return k === 'cards' ? r.yellow + r.red : (r[k as Exclude<SortKey, 'cards'>] as number | null);
    };
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (y - x) * -sort.dir || b.goals - a.goals || b.minutes - a.minutes;
    });
  }, [d.players, leagues, group, sort]);

  const maxMin = Math.max(1, ...rows.map((r) => r.minutes));
  const th = (key: SortKey, text: string) => (
    <th>
      <button type="button" className={`sh-th${sort.key === key ? ' on' : ''}`} onClick={() => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }))} aria-label={`Urutkan menurut ${text}`}>
        {text}
        {sort.key === key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );

  return (
    <section className="kp-card sh-card">
      <header className="kp-card-head">
        <h2 className="kp-title">Statistik pemain lengkap</h2>
        <small className="kp-muted">Main, menit, gol, assist, tembakan, konversi, rating, kartu</small>
      </header>
      <div className="sh-pills pad">
        {GROUPS.map((g) => (
          <button key={g} type="button" className={`sh-pill${group === g ? ' on' : ''}`} onClick={() => setGroup(g)}>
            {g === 'all' ? 'Semua posisi' : g}
          </button>
        ))}
      </div>
      <div className="sh-tablewrap">
        <table className="sh-table">
          <thead>
            <tr>
              <th className="l">PEMAIN</th>
              {th('played', 'MAIN')}{th('started', 'START')}{th('minutes', 'MENIT')}{th('goals', 'GOL')}{th('assists', 'ASSIST')}{th('ga', 'G+A')}{th('g90', 'GOL/90')}{th('ga90', 'G+A/90')}
              {th('shots', 'TEMBAKAN')}{th('onTarget', 'TEPAT')}{th('conv', 'KONVERSI')}{th('rating', 'RATING')}{th('cards', 'KARTU')}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.id}>
                <td className="l">
                  <div className="sh-who">
                    <Face src={r.p.photo} name={r.p.name} size={34} />
                    <div>
                      <b>{r.p.name}</b>
                      <small>{[r.p.group, r.p.pos].filter(Boolean).join(' · ')}</small>
                    </div>
                  </div>
                </td>
                <td>{r.played}</td>
                <td>{r.started}</td>
                <td>
                  <span className="sh-min"><i style={{ width: `${Math.max(6, (r.minutes / maxMin) * 46)}px` }} />{r.minutes}&apos;</span>
                </td>
                <td><b>{r.goals}</b></td>
                <td>{int(r.assists)}</td>
                <td><b>{int(r.ga)}</b></td>
                <td>{dec(r.g90)}</td>
                <td>{dec(r.ga90)}</td>
                <td>{int(r.shots)}</td>
                <td>{r.onTarget == null ? dash : <>{r.onTarget}{r.shots ? <small className="sh-sub">{pct(r.onTarget / r.shots)}</small> : null}</>}</td>
                <td>{r.conv == null ? dash : pct(r.conv)}</td>
                <td>{r.rating == null ? dash : <span className={`sh-r sh-r-${rTone(r.rating)}`}>{dec(r.rating, 1)}</span>}</td>
                <td>{r.yellow + r.red === 0 ? dash : <>{r.yellow > 0 && <span className="sh-cardb y">{r.yellow}</span>}{r.red > 0 && <span className="sh-cardb r">{r.red}</span>}</>}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={14} className="kp-empty">Tidak ada pemain di kategori ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="sh-foot">
        {label} · {matchCount} laga · statistik dari ringkasan laga ESPN. Rating adalah estimasi otomatis (skala 6,0 sebagai rata-rata), bukan rating resmi. Tanda “–” berarti ESPN tidak melaporkan angkanya.
      </p>
    </section>
  );
}

/* ---------- tab: rating pemain ---------- */

interface RRow {
  p: PlayerRow;
  n: number;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  stars: number;
  total: number;
  avg: number;
  last5: MatchRating[];
  best: MatchRating;
  perComp: Record<string, { n: number; avg: number }>;
}

function RatingTab({ d, leagues, slugs }: { d: PlayerStatsResponse; leagues: string[]; slugs: string[] }) {
  const [minGames, setMinGames] = useState(3);
  const [compare, setCompare] = useState(false);

  const rows: RRow[] = useMemo(() => {
    const out: RRow[] = [];
    for (const p of d.players) {
      const rs = ratingsIn(p, leagues);
      if (!rs.length) continue;
      const total = rs.reduce((n, r) => n + (r.rating as number), 0);
      const perComp: RRow['perComp'] = {};
      for (const s of slugs) {
        const c = rs.filter((r) => r.league === s);
        if (c.length) perComp[s] = { n: c.length, avg: avgOf(c) as number };
      }
      out.push({
        p,
        n: rs.length,
        appearances: leagues.reduce((n, l) => n + (p.by[l]?.played ?? 0), 0),
        minutes: rs.reduce((n, r) => n + r.minutes, 0),
        goals: rs.reduce((n, r) => n + r.goals, 0),
        assists: rs.reduce((n, r) => n + r.assists, 0),
        stars: rs.filter((r) => r.best).length,
        total,
        avg: total / rs.length,
        last5: rs.slice(-5),
        best: rs.reduce((a, b) => ((b.rating as number) > (a.rating as number) ? b : a)),
        perComp,
      });
    }
    // peringkat rata-rata hanya untuk pemain dengan laga minimal; sisanya di bawah menurut total
    return out.sort((a, b) => Number(b.n >= minGames) - Number(a.n >= minGames) || (a.n >= minGames && b.n >= minGames ? b.avg - a.avg : b.total - a.total));
  }, [d.players, leagues, slugs, minGames]);

  if (!rows.length) return <section className="kp-card sh-card"><div className="kp-empty">Rating belum tersedia: ESPN belum menyediakan statistik pemain yang cukup untuk laga-laga ini.</div></section>;

  const eligible = rows.filter((r) => r.n >= minGames);
  const topAvg = [...eligible].sort((a, b) => b.avg - a.avg)[0];
  const topTotal = [...rows].sort((a, b) => b.total - a.total)[0];
  const topStar = [...rows].sort((a, b) => b.stars - a.stars || b.avg - a.avg)[0];

  return (
    <section className="kp-card sh-card">
      <header className="kp-card-head">
        <h2 className="kp-title">Rating kumulatif pemain</h2>
        <small className="kp-muted">Rating Bianconeri (estimasi) per laga, dijumlah dan dirata-rata per kompetisi</small>
      </header>
      <div className="sh-rbar">
        <button type="button" className={`sh-pill dashed${compare ? ' on' : ''}`} onClick={() => setCompare((v) => !v)} aria-pressed={compare}>
          Per kompetisi <small>bandingkan</small>
        </button>
        <label>
          Min. laga untuk peringkat rata-rata
          <select value={minGames} onChange={(e) => setMinGames(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="sh-hl">
        {topAvg && (
          <div className="sh-hcard">
            <Face src={topAvg.p.photo} name={topAvg.p.name} size={52} />
            <div><small>RATA-RATA TERTINGGI</small><b>{topAvg.p.name}</b><span>{topAvg.n} laga · {topAvg.minutes}&apos;</span></div>
            <strong>{dec(topAvg.avg)}</strong>
          </div>
        )}
        <div className="sh-hcard">
          <Face src={topTotal.p.photo} name={topTotal.p.name} size={52} />
          <div><small>TOTAL RATING TERBANYAK</small><b>{topTotal.p.name}</b><span>{topTotal.n} laga</span></div>
          <strong>{dec(topTotal.total, 1)}</strong>
        </div>
        {topStar.stars > 0 && (
          <div className="sh-hcard">
            <Face src={topStar.p.photo} name={topStar.p.name} size={52} />
            <div><small>PALING SERING TERBAIK</small><b>{topStar.p.name}</b><span>rating tertinggi Juventus di laga</span></div>
            <strong>{topStar.stars}×</strong>
          </div>
        )}
      </div>

      <div className="sh-tablewrap">
        <table className="sh-table">
          <thead>
            <tr>
              <th>#</th><th className="l">PEMAIN</th><th>LAGA</th><th>MENIT</th><th>G · A</th><th>★</th><th>TOTAL</th><th className="on">RATA-RATA</th>
              {compare ? slugs.map((s) => <th key={s}>{COMP_SHORT[s] ?? compName(s)}</th>) : <th>5 LAGA TERAKHIR</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.p.id} className={r.n < minGames ? 'dim' : ''}>
                <td>{r.n >= minGames ? i + 1 : dash}</td>
                <td className="l">
                  <div className="sh-who">
                    <Face src={r.p.photo} name={r.p.name} size={38} />
                    <div>
                      <b>{r.p.name}</b>
                      <small>Terbaik: {dec(r.best.rating, 1)} vs {r.best.opp}</small>
                    </div>
                  </div>
                </td>
                <td>{r.n}{r.appearances !== r.n && <small className="sh-sub inline"> ({r.appearances})</small>}</td>
                <td>{r.minutes}&apos;</td>
                <td>{r.goals} · {r.assists}</td>
                <td>{r.stars || dash}</td>
                <td>{dec(r.total, 1)}</td>
                <td><span className={`sh-r sh-r-${rTone(r.avg)} big`}>{dec(r.avg)}</span></td>
                {compare ? (
                  slugs.map((s) => (
                    <td key={s}>{r.perComp[s] ? <><span className={`sh-r sh-r-${rTone(r.perComp[s].avg)}`}>{dec(r.perComp[s].avg, 1)}</span><small className="sh-sub">{r.perComp[s].n} laga</small></> : dash}</td>
                  ))
                ) : (
                  <td>
                    <div className="sh-last">
                      {r.last5.map((m) => (
                        <span key={m.matchId} className={`sh-r sh-r-${rTone(m.rating)}`} title={`${dateShort(m.iso)} vs ${m.opp}`}>{dec(m.rating, 1)}</span>
                      ))}
                    </div>
                    <small className="sh-sub">rata-rata {dec(avgOf(r.last5))}</small>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sh-foot">
        Rating adalah estimasi otomatis dari statistik ESPN (gol, assist, tembakan, penyelamatan, kartu, pelanggaran, hasil laga) dengan skala 6,0 sebagai rata-rata, bukan rating resmi. “Laga” = laga dengan rating; angka dalam kurung =
        jumlah penampilan. ★ = jumlah laga dengan rating tertinggi di antara pemain Juventus. Peringkat rata-rata hanya untuk pemain dengan laga minimal sesuai pilihan.
      </p>
    </section>
  );
}

/* ---------- tab: beban menit & risiko rotasi ---------- */

type Level = 'tinggi' | 'waspada' | 'aman';
const LEVEL_LABEL: Record<Level, string> = { tinggi: 'Tinggi', waspada: 'Waspada', aman: 'Aman' };
const LEVEL_RANK: Record<Level, number> = { tinggi: 0, waspada: 1, aman: 2 };
const DAY = 86_400_000;

/**
 * Risiko rotasi: aturan sederhana dari beban menit, bukan penilaian medis.
 *  Tinggi  : ≥ 360 menit dalam 14 hari, atau 5 start beruntun, atau ≥ 270 menit dengan ≥ 2 laga dalam 7 hari ke depan
 *  Waspada : ≥ 300 menit dalam 14 hari, atau 4 start beruntun, atau ≥ 270 menit pada usia 30+
 *  Aman    : selain itu
 */
function riskOf(min14: number, streak: number, age: number | null, next7: number): Level {
  if (min14 >= 360 || streak >= 5 || (min14 >= 270 && next7 >= 2)) return 'tinggi';
  if (min14 >= 300 || streak >= 4 || (min14 >= 270 && (age ?? 0) >= 30)) return 'waspada';
  return 'aman';
}

type BebanSort = 'risk' | 'm14' | 'm30' | 'streak' | 'name';

function BebanTab({ d }: { d: PlayerStatsResponse }) {
  const juve = useFetch<{ upcoming: Match[] }>('/api/juventus');
  const squad = useFetch<SquadResponse>('/api/squad');
  const [sort, setSort] = useState<BebanSort>('risk');
  const now = useMemo(() => Date.now(), []);

  const matches = d.matchList ?? [];
  const last8 = matches.slice(-8);
  const past14 = matches.filter((m) => now - new Date(m.iso).getTime() <= 14 * DAY && new Date(m.iso).getTime() <= now);
  const upcoming = (juve.data?.upcoming ?? []).filter((m) => new Date(m.iso).getTime() > now && new Date(m.iso).getTime() - now <= 14 * DAY);
  const next7 = upcoming.filter((m) => new Date(m.iso).getTime() - now <= 7 * DAY).length;
  const squadPlayers: SquadPlayer[] = squad.data?.players ?? [];

  const rows = useMemo(() => {
    const minutesIn = (apps: { iso: string; minutes: number }[], days: number) =>
      apps.filter((a) => now - new Date(a.iso).getTime() <= days * DAY && new Date(a.iso).getTime() <= now).reduce((n, a) => n + a.minutes, 0);
    const out = (d.players ?? []).map((p) => {
      const apps = p.apps ?? [];
      const byMatch = new Map(apps.map((a) => [a.matchId, a]));
      let streak = 0;
      for (let i = matches.length - 1; i >= 0; i--) {
        if (byMatch.get(matches[i].id)?.started) streak++;
        else break;
      }
      const age = (findPlayer(p.name, squadPlayers) as SquadPlayer | null)?.age ?? null;
      const m7 = minutesIn(apps, 7);
      const m14 = minutesIn(apps, 14);
      const m30 = minutesIn(apps, 30);
      return { p, age, m7, m14, m30, streak, level: riskOf(m14, streak, age, next7), bars: last8.map((m) => ({ m, a: byMatch.get(m.id) ?? null })) };
    });
    return out
      .filter((r) => r.m30 > 0)
      .sort((a, b) => {
        if (sort === 'name') return a.p.name.localeCompare(b.p.name);
        if (sort === 'm14') return b.m14 - a.m14 || b.m30 - a.m30;
        if (sort === 'm30') return b.m30 - a.m30;
        if (sort === 'streak') return b.streak - a.streak || b.m14 - a.m14;
        return LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || b.m14 - a.m14 || b.m30 - a.m30;
      });
  }, [d.players, matches, last8, squadPlayers, next7, now, sort]);

  const surname = (n: string) => n.split(' ').slice(1).join(' ') || n;
  const names = (lv: Level) => rows.filter((r) => r.level === lv).map((r) => surname(r.p.name));
  const high = names('tinggi');
  const watch = names('waspada');
  const chip = (iso: string, opp: string, soon: boolean) => (
    <span key={iso} className={`bm-chip${soon ? ' soon' : ''}`}>
      <small>{dateShort(iso)}</small>
      {opp}
    </span>
  );

  return (
    <section className="kp-card sh-card">
      <header className="kp-card-head">
        <h2 className="kp-title">Beban menit &amp; risiko rotasi</h2>
        <small className="kp-muted">Siapa yang paling lelah dan perlu diistirahatkan</small>
      </header>

      <div className="bm-timeline">
        <div>
          <small className="bm-cap">14 HARI TERAKHIR</small>
          <div className="bm-chips">{past14.length ? past14.map((m) => chip(m.iso, m.opp, false)) : <span className="bm-none">Tidak ada laga</span>}</div>
        </div>
        <div className="bm-now" aria-label="Hari ini"><span>HARI INI</span></div>
        <div>
          <small className="bm-cap">14 HARI KE DEPAN</small>
          <div className="bm-chips">{upcoming.length ? upcoming.map((m) => chip(m.iso, m.opponent, true)) : <span className="bm-none">{juve.loading ? 'Memuat jadwal…' : 'Tidak ada laga'}</span>}</div>
        </div>
      </div>

      <div className="bm-tiles">
        <div><small>Laga 7 hari ke depan</small><b>{next7}</b><span>{next7 === 0 ? 'jadwal longgar' : next7 === 1 ? 'jadwal normal' : 'jadwal padat'}</span></div>
        <div><small>Risiko tinggi</small><b>{high.length}</b><span>{high.length ? high.slice(0, 3).join(', ') : 'tidak ada'}</span></div>
        <div><small>Perlu diwaspadai</small><b>{watch.length}</b><span>{watch.length ? watch.slice(0, 3).join(', ') + (watch.length > 3 ? ` +${watch.length - 3}` : '') : 'tidak ada'}</span></div>
      </div>

      <div className="bm-bar">
        <small>Batang = menit di {last8.length} laga terakhir Juventus (merah = starter, abu-abu = pengganti)</small>
        <label>
          Urutkan
          <select value={sort} onChange={(e) => setSort(e.target.value as BebanSort)}>
            <option value="risk">Risiko</option>
            <option value="m14">Menit 14 hari</option>
            <option value="m30">Menit 30 hari</option>
            <option value="streak">Start beruntun</option>
            <option value="name">Nama</option>
          </select>
        </label>
      </div>

      <div className="sh-tablewrap">
        <table className="sh-table bm-table">
          <thead>
            <tr>
              <th className="l">PEMAIN</th><th>STATUS</th><th>{last8.length} LAGA TERAKHIR</th><th>7 HARI</th><th className="strong">14 HARI</th><th>30 HARI</th><th>START BERUNTUN</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.id}>
                <td className="l">
                  <div className="sh-who">
                    <Face src={r.p.photo} name={r.p.name} size={34} />
                    <div>
                      <b>{r.p.name}</b>
                      <small>{[r.p.pos || r.p.group, r.age != null ? `${r.age} th` : ''].filter(Boolean).join(' · ')}</small>
                    </div>
                  </div>
                </td>
                <td><span className={`bm-s bm-s-${r.level}`}>{LEVEL_LABEL[r.level]}</span></td>
                <td>
                  <span className="bm-bars">
                    {r.bars.map(({ m, a }) => (
                      <i key={m.id} className={a ? (a.started ? 'st' : 'sub') : 'none'} style={a ? { height: `${Math.max(4, Math.min(1, a.minutes / 90) * 36)}px` } : undefined} title={`${dateShort(m.iso)} vs ${m.opp}: ${a ? `${a.minutes}'${a.started ? ' (starter)' : ' (pengganti)'}` : 'tidak main'}`} />
                    ))}
                  </span>
                </td>
                <td>{r.m7}&apos;</td>
                <td><b>{r.m14}&apos;</b></td>
                <td>{r.m30}&apos;</td>
                <td>{r.streak}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="kp-empty">Belum ada pemain dengan menit bermain dalam 30 hari terakhir.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="sh-foot">
        Menit dihitung dari susunan pemain dan pergantian (tanpa injury time) di semua kompetisi, jadi tidak mengikuti filter kompetisi. Risiko adalah aturan sederhana, bukan penilaian medis: <b>Tinggi</b> = 360 menit atau lebih dalam 14 hari,
        5 start beruntun, atau 270 menit atau lebih dengan 2 laga atau lebih dalam 7 hari ke depan; <b>Waspada</b> = 300 menit atau lebih, 4 start beruntun, atau 270 menit atau lebih pada usia 30 tahun ke atas. Pemain tanpa menit dalam 30 hari terakhir tidak ditampilkan.
      </p>
    </section>
  );
}

/* ---------- tab: statistik tim per laga ---------- */

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const num1 = (v: number | null) => (v == null ? dash : v.toFixed(1).replace('.', ','));
const pair = (p: [number | null, number | null] | undefined, d = 0) => `${p?.[0] == null ? dash : d ? dec(p[0], d) : p[0]}–${p?.[1] == null ? dash : d ? dec(p[1], d) : p[1]}`;

function TimTab({ d, leagues }: { d: PlayerStatsResponse; leagues: string[] }) {
  const list: PlayedMatch[] = useMemo(() => [...(d.matchList ?? [])].filter((m) => leagues.includes(m.league)).sort((a, b) => b.iso.localeCompare(a.iso)), [d.matchList, leagues]);
  if (!list.length) return <section className="kp-card sh-card"><div className="kp-empty">Belum ada laga selesai pada kompetisi ini.</div></section>;

  const st = (f: (s: NonNullable<PlayedMatch['stats']>) => number | null) => list.map((m) => (m.stats ? f(m.stats) : null));
  const poss = mean(st((s) => s.possession[0]));
  const shotsJ = mean(st((s) => s.shots[0]));
  const shotsO = mean(st((s) => s.shots[1]));
  const onJ = mean(st((s) => s.onTarget[0]));
  const xgJ = mean(st((s) => s.xg[0]));
  const xgO = mean(st((s) => s.xg[1]));
  const corners = mean(st((s) => s.corners[0]));
  const fouls = mean(st((s) => s.fouls[0]));
  const gf = list.reduce((n, m) => n + m.score[0], 0) / list.length;
  const ga = list.reduce((n, m) => n + m.score[1], 0) / list.length;

  return (
    <section className="kp-card sh-card">
      <header className="kp-card-head">
        <h2 className="kp-title">Statistik tim per laga</h2>
        <small className="kp-muted">Penguasaan bola, tembakan, xG, sepak pojok, pelanggaran</small>
      </header>

      <div className="tm-tiles">
        <div className="hero">
          <small>Penguasaan bola</small>
          <b>{poss == null ? dash : `${Math.round(poss)}%`}</b>
          <span>rata-rata per laga</span>
        </div>
        <div><small>Tembakan</small><b>{num1(shotsJ)}</b><span>tepat {num1(onJ)} · lawan {num1(shotsO)}</span></div>
        <div><small>Gol per laga</small><b>{dec(gf)}</b><span>kebobolan {dec(ga)}</span></div>
        <div><small>xG per laga</small><b>{dec(xgJ)}</b><span>{xgJ == null ? 'ESPN tidak melaporkan xG' : `xG lawan ${dec(xgO)}`}</span></div>
        <div><small>Sepak pojok</small><b>{num1(corners)}</b><span>per laga</span></div>
        <div><small>Pelanggaran</small><b>{num1(fouls)}</b><span>per laga</span></div>
      </div>

      <div className="sh-tablewrap">
        <table className="sh-table tm-table">
          <thead>
            <tr><th className="l">LAGA</th><th>SKOR</th><th>PENGUASAAN</th><th>TEMBAKAN</th><th>TEPAT SASARAN</th><th>XG</th><th>POJOK</th><th>PELANGGARAN</th><th>PENONTON</th></tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const res = m.score[0] > m.score[1] ? 'w' : m.score[0] === m.score[1] ? 'd' : 'l';
              const p = m.stats?.possession[0] ?? null;
              return (
                <tr key={m.id}>
                  <td className="l">
                    <b>{m.home ? 'vs' : 'di'} {m.opp}</b>
                    <small className="sh-sub">{dateShort(m.iso)} · {COMP_SHORT[m.league] ?? compName(m.league)}</small>
                  </td>
                  <td><span className={`tm-score ${res}`}>{m.score[0]}–{m.score[1]}</span></td>
                  <td>{p == null ? dash : <span className="sh-min"><i style={{ width: `${Math.max(4, (p / 100) * 46)}px` }} />{Math.round(p)}%</span>}</td>
                  <td>{pair(m.stats?.shots)}</td>
                  <td>{pair(m.stats?.onTarget)}</td>
                  <td>{pair(m.stats?.xg, 2)}</td>
                  <td>{m.stats?.corners[0] ?? dash}</td>
                  <td>{m.stats?.fouls[0] ?? dash}</td>
                  <td>{m.stats?.attendance ? new Intl.NumberFormat('id-ID').format(m.stats.attendance) : dash}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sh-foot">Angka Juventus ditulis lebih dulu (Juventus–lawan). Semua kompetisi dalam filter · data ESPN/Opta. Tanda “–” berarti ESPN tidak melaporkan angkanya untuk laga itu (xG dan penonton tidak tersedia di semua kompetisi).</p>
    </section>
  );
}

/* ---------- tab: kartu & ancaman skorsing (aturan Italia) ---------- */

/**
 * Aturan skorsing akumulasi kartu kuning 2026/27, dirangkum dari FIGC (CU n. 103) dan media Italia (Goal.com, Calcionapoli24, Pazzi di Fanta).
 * `nextBan(n)` = jumlah kartu kuning yang memicu skorsing berikutnya bila pemain sekarang punya n kartu; null = di luar aturan yang dimodelkan.
 */
interface CardRule {
  name: string;
  /** ambang skorsing pertama */
  first: number;
  nextBan: (n: number) => number | null;
  note: string;
}
const SERIE_A_BANS = [5, 10, 14, 17, 19];
const CARD_RULES: Record<string, CardRule> = {
  'ita.1': {
    name: 'Serie A',
    first: 5,
    nextBan: (n) => SERIE_A_BANS.find((t) => t > n) ?? n + 1,
    note: 'skors di kartu ke-5, lalu ke-10, 14, 17, 19, dan seterusnya',
  },
  'uefa.champions': { name: 'Liga Champions', first: 4, nextBan: (n) => (n < 4 ? 4 : 4 + 2 * (Math.floor((n - 4) / 2) + 1)), note: 'skors di kartu ke-4, lalu tiap 2 kartu (6, 8, …)' },
  'uefa.europa': { name: 'Liga Europa', first: 4, nextBan: (n) => (n < 4 ? 4 : 4 + 2 * (Math.floor((n - 4) / 2) + 1)), note: 'skors di kartu ke-4, lalu tiap 2 kartu (6, 8, …)' },
  'ita.coppa_italia': { name: 'Coppa Italia', first: 2, nextBan: (n) => (n < 2 ? 2 : null), note: 'skors di kartu ke-2; hitungan dikosongkan setelah babak sedicesimi' },
};
/** Jumlah laga fase liga UEFA; setelahnya hitungan kartu kuning dikosongkan. */
const UEFA_LEAGUE_PHASE = 8;

interface KCell {
  slug: string;
  count: number;
  /** kartu lagi sampai skorsing; null bila tidak dimodelkan */
  left: number | null;
}
interface KRow {
  p: PlayerRow;
  cells: KCell[];
  yellowTotal: number;
  reds: { opp: string; iso: string }[];
  /** kartu paling sedikit yang tersisa di kompetisi mana pun */
  minLeft: number | null;
}

function KartuTab({ d }: { d: PlayerStatsResponse }) {
  const matches = d.matchList ?? [];
  const byId = new Map(matches.map((m) => [m.id, m]));
  const present = (slug: string) => (d.matches[slug] ?? 0) > 0;
  // kolom: Serie A dan Coppa Italia selalu ada; kompetisi Eropa menurut yang dimainkan (default Liga Champions)
  const euro = ['uefa.champions', 'uefa.europa'].filter(present);
  const slugs = ['ita.1', ...(euro.length ? euro : ['uefa.champions']), 'ita.coppa_italia'];
  const showSuper = present('ita.super_cup');

  const rows: KRow[] = useMemo(() => {
    const out: KRow[] = [];
    for (const p of d.players) {
      const apps = p.apps ?? [];
      if (!apps.length) continue;
      const cells: KCell[] = slugs.map((slug) => {
        let yellow = 0;
        const inComp = apps.filter((a) => byId.get(a.matchId)?.league === slug);
        if (slug.startsWith('uefa.')) {
          // fase liga = UEFA_LEAGUE_PHASE laga pertama; sesudahnya hitungan dikosongkan
          const order = matches.filter((m) => m.league === slug).map((m) => m.id);
          const afterReset = order.length > UEFA_LEAGUE_PHASE;
          yellow = inComp.filter((a) => (afterReset ? order.indexOf(a.matchId) >= UEFA_LEAGUE_PHASE : true)).reduce((n, a) => n + a.yellow, 0);
        } else {
          yellow = inComp.reduce((n, a) => n + a.yellow, 0);
        }
        const rule = CARD_RULES[slug];
        const next = rule ? rule.nextBan(yellow) : null;
        return { slug, count: yellow, left: next == null ? null : next - yellow };
      });
      const reds = apps.filter((a) => a.red > 0).map((a) => ({ opp: byId.get(a.matchId)?.opp ?? '', iso: a.iso }));
      const lefts = cells.map((c) => c.left).filter((v): v is number => v != null);
      out.push({ p, cells, yellowTotal: apps.reduce((n, a) => n + a.yellow, 0), reds, minLeft: lefts.length ? Math.min(...lefts) : null });
    }
    return out.sort((a, b) => (a.minLeft ?? 99) - (b.minLeft ?? 99) || b.yellowTotal - a.yellowTotal || a.p.name.localeCompare(b.p.name));
  }, [d.players, matches, slugs.join(',')]);

  const surname = (n: string) => n.split(' ').slice(1).join(' ') || n;
  const one = rows.filter((r) => r.minLeft === 1);
  const two = rows.filter((r) => r.minLeft === 2);
  const reds = rows.filter((r) => r.reds.length);
  const totalYellow = rows.reduce((n, r) => n + r.yellowTotal, 0);
  const league = CARD_RULES['ita.1'];
  const serieMatches = d.matches['ita.1'] ?? 0;
  const tone = (left: number | null) => (left == null ? 'na' : left <= 1 ? 'hi' : left === 2 ? 'mid' : 'ok');

  return (
    <section className="kp-card sh-card">
      <header className="kp-card-head">
        <h2 className="kp-title">Kartu &amp; ancaman skorsing</h2>
        <small className="kp-muted">Akumulasi kartu kuning vs batas larangan main tiap kompetisi</small>
      </header>

      <div className="kt-tiles">
        <div className="hero"><small>Kartu kuning</small><b>{totalYellow}</b><span>semua kompetisi musim ini</span></div>
        <div><small>1 kartu lagi skorsing</small><b>{one.length}</b><span>{one.length ? one.slice(0, 4).map((r) => surname(r.p.name)).join(', ') : 'tidak ada'}</span></div>
        <div className="warn"><small>Perlu waspada</small><b>{two.length}</b><span>{two.length ? two.slice(0, 4).map((r) => surname(r.p.name)).join(', ') + (two.length > 4 ? ` +${two.length - 4}` : '') : 'tidak ada'}</span></div>
        <div><small>Kartu merah</small><b>{reds.reduce((n, r) => n + r.reds.length, 0)}</b><span>{reds.length ? reds.map((r) => surname(r.p.name)).join(', ') : 'tidak ada'}</span></div>
      </div>

      <div className="sh-tablewrap">
        <table className="sh-table kt-table">
          <thead>
            <tr>
              <th className="l">PEMAIN</th>
              <th><i className="kt-ic y" /> SERIE A</th>
              <th className="l">STATUS SERIE A</th>
              {slugs.slice(1).map((s) => (
                <th key={s}><i className="kt-ic y" /> {s === 'ita.coppa_italia' ? 'COPPA ITALIA' : (CARD_RULES[s]?.name ?? s).toUpperCase()}</th>
              ))}
              {showSuper && <th><i className="kt-ic y" /> SUPERCOPPA</th>}
              <th><i className="kt-ic r" /> MERAH</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = r.cells[0];
              return (
                <tr key={r.p.id}>
                  <td className="l">
                    <div className="sh-who">
                      <Face src={r.p.photo} name={r.p.name} size={34} />
                      <div><b>{r.p.name}</b><small>{r.p.pos || r.p.group}</small></div>
                    </div>
                  </td>
                  <td><b>{a.count}</b></td>
                  <td className="l">
                    {a.left != null && (
                      <>
                        <span className={`kt-badge kt-${tone(a.left)}`}>{a.left === 1 ? '1 kartu lagi · diffidato' : `${a.left} kartu lagi`}</span>
                        <small className="sh-sub left">skors di kartu ke-{a.count + a.left}{a.count + a.left === league.first ? ' (ambang pertama)' : ''}</small>
                      </>
                    )}
                  </td>
                  {r.cells.slice(1).map((c) => (
                    <td key={c.slug}>
                      {c.count}
                      {c.count > 0 && c.left != null && <small className="sh-sub">{c.left} lagi = absen</small>}
                    </td>
                  ))}
                  {showSuper && <td>{r.p.apps && r.p.by['ita.super_cup'] ? r.p.by['ita.super_cup'].yellow : 0}</td>}
                  <td className="l">
                    {r.reds.length ? r.reds.map((x) => <span key={x.iso} className="kt-red"><i className="kt-ic r" /> vs {x.opp} ({dateShort(x.iso)})</span>) : dash}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={7} className="kp-empty">Belum ada data kartu pemain.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="kt-rules">
        <summary>Aturan skorsing 2026/27</summary>
        <ul>
          <li><b>Serie A:</b> diffida di kartu kuning ke-4, skorsing 1 laga di kartu ke-5. Skorsing berikutnya setelah 5, 4, 3, 2, lalu 1 kartu tambahan (kartu ke-10, 14, 17, 19, dan seterusnya). Hitungan mulai dari nol tiap musim baru; skorsing yang belum dijalani di akhir musim dibawa ke musim berikutnya.</li>
          <li><b>Coppa Italia:</b> skorsing di kartu kuning ke-2 dalam turnamen; hitungan kartu dikosongkan setelah babak sedicesimi (CU FIGC n. 103, musim 2025/26 dan 2026/27). Aturan setelah skorsing pertama tidak dimodelkan di sini.</li>
          <li><b>Liga Champions / Europa / Conference:</b> mulai 2026/27 ambang skorsing naik menjadi kartu ke-4, lalu tiap 2 kartu tambahan (6, 8, …); sebelumnya 3, 5, 7. Menurut ringkasan media, hitungan dikosongkan setelah fase liga dan lagi setelah perempat final. Tabel ini mengosongkan hitungan setelah {UEFA_LEAGUE_PHASE} laga fase liga, tetapi belum mengosongkannya setelah perempat final.</li>
          <li><b>Kartu merah:</b> skorsing minimal 1 laga; lama sebenarnya ditentukan Giudice Sportivo (Italia) atau UEFA. Skorsing akumulasi hanya dihitung per kompetisi; Supercoppa memakai aturan khusus dan tidak dimodelkan.</li>
        </ul>
        <p>Ini ringkasan dari sumber berita dan FIGC, bukan teks regulasi resmi. Untuk keputusan penting, cek Codice di Giustizia Sportiva FIGC dan regulasi disiplin UEFA.</p>
      </details>

      <p className="sh-foot">
        Kartu dihitung otomatis dari data laga ESPN ({serieMatches} laga Serie A dimainkan), bukan daftar resmi Giudice Sportivo; kartu yang kemudian dianulir tidak terlihat di sini. Sumber aturan:{' '}
        <a href="https://files.figc.it/version/c:ZWFmZmNhNzEtNmQ1Ny00:ZmVhYzAzMzYtMDA5ZS00/103%20-%20Estinzione%20Ammonizioni%20Coppa%20Italia%20Frecciarossa%202025-2026%20e%202026-2027.pdf" target="_blank" rel="noopener noreferrer">FIGC CU 103</a> ·{' '}
        <a href="https://www.goal.com/it/notizie/regolamento-coppa-italia-squalificati-e-diffidati-come-funziona/1wwglltuw4o7f183e9qdnc0twc" target="_blank" rel="noopener noreferrer">Goal.com (Coppa Italia)</a> ·{' '}
        <a href="https://www.pazzidifanta.com/news/uefa-modifiche-regolamento-cambia-squalifiche-458493" target="_blank" rel="noopener noreferrer">Pazzi di Fanta (aturan UEFA baru)</a>.
      </p>
    </section>
  );
}

/* ---------- halaman ---------- */

export default function StatisticsPage() {
  const res = useFetch<PlayerStatsResponse>('/api/juventus/stats');
  const [tab, setTab] = useState<TabKey>('gol');
  const [league, setLeague] = useState('all');
  const d = res.data;

  if (res.loading) return <div className="kp"><div className="kp-card kp-empty">Memuat statistik… pemuatan pertama bisa agak lama karena semua laga diperiksa.</div></div>;
  if (res.error || !d || !d.players.length) return <div className="kp"><div className="kp-card kp-empty">Statistik pemain belum bisa dimuat dari ESPN. Coba muat ulang beberapa saat lagi.</div></div>;

  const comps = COMP_LABEL.filter(([s]) => (d.matches[s] ?? 0) > 0);
  const slugs = comps.map(([s]) => s);
  const total = slugs.reduce((n, s) => n + d.matches[s], 0);
  const leagues = league === 'all' ? slugs : [league];
  const count = league === 'all' ? total : d.matches[league] ?? 0;
  const label = league === 'all' ? 'Semua kompetisi' : compName(league);

  return (
    <div className="kp" id="statistik">
      <Tiles d={d} />

      <div className="kp-tabs" role="tablist" aria-label="Jenis statistik">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`kp-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'beban' || tab === 'kartu' ? (
        <div className="sh-pills top"><span className="sh-note">Semua kompetisi · {total} laga · data live ESPN</span></div>
      ) : (
        <div className="sh-pills top">
          <button type="button" className={`sh-pill${league === 'all' ? ' on' : ''}`} onClick={() => setLeague('all')}>Semua <small>{total}</small></button>
          {comps.map(([s]) => (
            <button key={s} type="button" className={`sh-pill${league === s ? ' on' : ''}`} onClick={() => setLeague(s)}>
              {COMP_SHORT[s] ?? compName(s)} <small>{d.matches[s]}</small>
            </button>
          ))}
          <span className="sh-note">{label} · {count} laga · data live ESPN</span>
        </div>
      )}

      {tab === 'gol' && <GolTab d={d} leagues={leagues} matchCount={count} label={label} />}
      {tab === 'rating' && <RatingTab d={d} leagues={leagues} slugs={slugs} />}
      {tab === 'beban' && <BebanTab d={d} />}
      {tab === 'tim' && <TimTab d={d} leagues={leagues} />}
      {tab === 'kartu' && <KartuTab d={d} />}
      {tab !== 'gol' && tab !== 'rating' && tab !== 'beban' && tab !== 'tim' && tab !== 'kartu' && (
        <section className="kp-card sh-card">
          <header className="kp-card-head"><h2 className="kp-title">{TABS.find((t) => t.key === tab)?.label}</h2></header>
          <div className="kp-empty">Bagian ini belum tersedia.</div>
        </section>
      )}
    </div>
  );
}
