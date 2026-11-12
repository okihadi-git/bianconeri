'use client';

import { useMemo, useState } from 'react';
import Face from '@/components/Face';
import { useFetch } from '@/components/kp';
import type { MatchRating, PlayerRow, PlayerStatsResponse, PosGroup } from '@/lib/playerstats';
import '@/components/stathub.css';

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

      <div className="sh-pills top">
        <button type="button" className={`sh-pill${league === 'all' ? ' on' : ''}`} onClick={() => setLeague('all')}>Semua <small>{total}</small></button>
        {comps.map(([s]) => (
          <button key={s} type="button" className={`sh-pill${league === s ? ' on' : ''}`} onClick={() => setLeague(s)}>
            {COMP_SHORT[s] ?? compName(s)} <small>{d.matches[s]}</small>
          </button>
        ))}
        <span className="sh-note">{label} · {count} laga · data live ESPN</span>
      </div>

      {tab === 'gol' && <GolTab d={d} leagues={leagues} matchCount={count} label={label} />}
      {tab === 'rating' && <RatingTab d={d} leagues={leagues} slugs={slugs} />}
      {tab !== 'gol' && tab !== 'rating' && (
        <section className="kp-card sh-card">
          <header className="kp-card-head"><h2 className="kp-title">{TABS.find((t) => t.key === tab)?.label}</h2></header>
          <div className="kp-empty">Bagian ini belum tersedia.</div>
        </section>
      )}
    </div>
  );
}
