'use client';

import { useMemo, useState } from 'react';
import Face from '@/components/Face';
import { useFetch } from '@/components/kp';
import type { AcademyKey, AcademyPlayer, AcademyTeam, AkademiResponse, LoanPlayer } from '@/lib/akademi';
import { sameNameStrict } from '@/lib/names';
import { totalsOf } from '@/lib/playerprofile';
import type { PlayerStatsResponse } from '@/lib/playerstats';
import { dayLabel, shortDate, timeLabel } from '@/lib/wib';
import type { WMatch, WStandingRow } from '@/lib/women';

type Tab = AcademyKey | 'loans';

const TEAM_LABEL: Record<AcademyKey, string> = { nextgen: 'Next Gen', youth: 'Youth' };
const dec = (n: number, d = 2) => n.toFixed(d).replace('.', ',');
const letter = (r: WMatch['result']) => (r === 'W' ? 'M' : r === 'D' ? 'S' : r === 'L' ? 'K' : '');

/* ---------- potongan kecil ---------- */

function FormBadges({ form }: { form: ('M' | 'S' | 'K')[] }) {
  return (
    <span className="ak-form">
      {form.map((f, i) => (
        <i key={i} className={`ak-b ak-b-${f}`}>
          {f}
        </i>
      ))}
    </span>
  );
}

function ResultRow({ m }: { m: WMatch }) {
  const l = letter(m.result);
  return (
    <li className="ak-res">
      <i className={`ak-b ak-b-${l || 'S'}`}>{l || '–'}</i>
      <div className="ak-res-main">
        <b>
          <span aria-hidden="true">{m.home ? '🏠' : '✈️'}</span> {m.opponent}
        </b>
        <small>
          {shortDate(m.iso)} · {m.tournament || m.comp}
        </small>
      </div>
      {m.score && (
        <span className="ak-score">
          {m.score.us}-{m.score.them}
        </span>
      )}
    </li>
  );
}

function NextRow({ m }: { m: WMatch }) {
  return (
    <li className="ak-next">
      <span className="ak-ico" aria-hidden="true">
        {m.home ? '🏠' : '✈️'}
      </span>
      <div className="ak-res-main">
        <b>{m.opponent}</b>
        <small>{m.tournament || m.comp}</small>
      </div>
      <span className="ak-when">{m.status === 'live' ? 'LIVE' : `${dayLabel(m.iso)}, ${timeLabel(m.iso)}`}</span>
    </li>
  );
}

/** Klasemen: 7 baris di sekitar Juventus; tombol untuk membuka semuanya. */
function StandingsBlock({ rows }: { rows: WStandingRow[] }) {
  const [all, setAll] = useState(false);
  const idx = Math.max(0, rows.findIndex((r) => r.isJuve));
  const start = Math.max(0, Math.min(idx - 3, rows.length - 7));
  const shown = all ? rows : rows.slice(start, start + 7);
  return (
    <div>
      <h3 className="ak-sub">Klasemen</h3>
      <div className="ak-tbl-wrap">
        <table className="wm-table">
          <thead>
            <tr>
              <th>#</th>
              <th className="wm-l">Tim</th>
              <th>Main</th>
              <th>SG</th>
              <th>Poin</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
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
                <td>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
                <td>
                  <b>{r.points}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 7 && (
        <button type="button" className="ak-more" onClick={() => setAll((v) => !v)}>
          {all ? 'Ringkas klasemen' : `Lihat klasemen lengkap (${rows.length} tim)`}
        </button>
      )}
    </div>
  );
}

function TeamPanel({ t }: { t: AcademyTeam }) {
  return (
    <section className="kp-card ak-panel">
      <header className="kp-card-head">
        <h2 className="kp-title">{t.name}</h2>
        <small className="kp-muted">{[t.league, t.coach && `Pelatih ${t.coach}`, t.stadium].filter(Boolean).join(' · ')}</small>
      </header>
      <div className="ak-cols">
        <div>
          <h3 className="ak-sub">
            Hasil terakhir <FormBadges form={t.form} />
          </h3>
          {t.results.length ? (
            <ul className="ak-list">
              {t.results.slice(0, 6).map((m) => (
                <ResultRow key={m.id} m={m} />
              ))}
            </ul>
          ) : (
            <p className="kp-muted ak-none">Belum ada hasil.</p>
          )}
          <h3 className="ak-sub">Jadwal berikutnya</h3>
          {t.next.length ? (
            <ul className="ak-list">
              {t.next.slice(0, 4).map((m) => (
                <NextRow key={m.id} m={m} />
              ))}
            </ul>
          ) : (
            <p className="kp-muted ak-none">Belum ada jadwal.</p>
          )}
        </div>
        {t.standings.length ? <StandingsBlock rows={t.standings} /> : <p className="kp-muted ak-none">Klasemen belum tersedia dari sumber data.</p>}
      </div>
    </section>
  );
}

/* ---------- pinjaman ---------- */

const ratingClass = (r: number | null) => (r == null ? '' : r >= 7 ? 'hi' : 'mid');
const roleOf = (pct: number) => (pct >= 75 ? { label: 'Pemain inti', cls: 'core' } : pct >= 40 ? { label: 'Rotasi', cls: 'rot' } : { label: 'Jarang main', cls: 'rare' });

function LoanCard({ p }: { p: LoanPlayer }) {
  return (
    <article className="ak-loan">
      <header className="ak-loan-head">
        <Face src={p.photo} name={p.name} size={52} />
        <div>
          <b>{p.name}</b>
          <small>{[p.age != null ? `${p.age} th` : '', p.position].filter(Boolean).join(' · ')}</small>
          <small className="ak-loan-club">{[p.club, p.league].filter(Boolean).join(' · ')}</small>
        </div>
        {p.rating != null && <span className={`ak-rate ${ratingClass(p.rating)}`}>{dec(p.rating, 1)}</span>}
      </header>
      <div className="ak-tiles">
        <div>
          <b>{p.apps}</b>
          <small>laga</small>
        </div>
        <div>
          <b>{p.minutes}&prime;</b>
          <small>menit</small>
        </div>
        <div>
          <b>{p.goals}</b>
          <small>gol</small>
        </div>
        <div>
          <b>{p.assists}</b>
          <small>assist</small>
        </div>
      </div>
      <ul className="ak-list ak-list-tight">
        {p.matches.map((m) => (
          <li key={m.id || m.iso} className="ak-res">
            <i className={`ak-b ak-b-${m.result ?? 'S'}`}>{m.result ?? '–'}</i>
            <div className="ak-res-main">
              <b>
                <span aria-hidden="true">{m.home ? '🏠' : '✈️'}</span> {m.opponent}
              </b>
              <small>
                {shortDate(m.iso)} · {m.competition}
              </small>
            </div>
            <span className="ak-score ak-score-sm">{m.score ? `${m.score.us}–${m.score.them}` : ''}</span>
            <span className="ak-min">{m.minutes > 0 ? `${m.minutes}′` : 'cadangan'}</span>
            {m.rating != null && <span className={`ak-rate ak-rate-sm ${ratingClass(m.rating)}`}>{dec(m.rating, 1)}</span>}
          </li>
        ))}
      </ul>
    </article>
  );
}

function LoanPanel({ loans }: { loans: LoanPlayer[] }) {
  const apps = loans.reduce((n, p) => n + p.apps, 0);
  const minutes = loans.reduce((n, p) => n + p.minutes, 0);
  const ga = loans.reduce((n, p) => n + p.goals + p.assists, 0);
  const goals = loans.reduce((n, p) => n + p.goals, 0);
  const rated = loans.filter((p) => p.rating != null);
  const avg = rated.length ? rated.reduce((n, p) => n + (p.rating as number), 0) / rated.length : null;
  const best = rated.reduce<LoanPlayer | null>((b, p) => (!b || (p.rating as number) > (b.rating as number) ? p : b), null);
  return (
    <section className="kp-card ak-panel">
      <header className="kp-card-head">
        <h2 className="kp-title">Pemain yang dipinjamkan</h2>
        <small className="kp-muted">Statistik di klub peminjam · 5 laga terakhir</small>
      </header>
      {!loans.length ? (
        <div className="kp-empty">Tidak ada pemain pinjaman yang tercatat di FotMob musim ini.</div>
      ) : (
        <div className="ak-loan-body">
          <div className="kp-metrics">
            <div className="kp-metric kp-metric-red">
              <div className="kp-metric-label">Dipinjamkan</div>
              <div className="kp-metric-val">{loans.length}</div>
              <div className="kp-metric-sub">
                {apps} laga · {minutes.toLocaleString('id-ID')} menit
              </div>
            </div>
            <div className="kp-metric">
              <div className="kp-metric-label">Gol + assist</div>
              <div className="kp-metric-val">{ga}</div>
              <div className="kp-metric-sub">
                {goals} gol · {ga - goals} assist
              </div>
            </div>
            <div className="kp-metric">
              <div className="kp-metric-label">Rating rata-rata</div>
              <div className="kp-metric-val">{avg != null ? dec(avg) : '–'}</div>
              <div className="kp-metric-sub">liga di klub peminjam</div>
            </div>
            <div className="kp-metric">
              <div className="kp-metric-label">Paling bersinar</div>
              <div className="kp-metric-val sq-coach">{best ? best.name.split(' ').slice(-1)[0] : '–'}</div>
              <div className="kp-metric-sub">{best ? `${dec(best.rating as number)} · ${best.club}` : ' '}</div>
            </div>
          </div>

          <div className="ak-mins kp-card">
            <h3 className="ak-sub">Menit bermain 5 laga terakhir</h3>
            {loans.map((p) => {
              const role = roleOf(p.minutesPct);
              return (
                <div className="ak-min-row" key={p.id}>
                  <span>{p.name}</span>
                  <i className="ak-bar">
                    <u className={role.cls} style={{ width: `${Math.max(2, p.minutesPct)}%` }} />
                  </i>
                  <b className={role.cls}>
                    {role.label} · {p.minutesPct}%
                  </b>
                </div>
              );
            })}
          </div>

          <div className="ak-loan-grid">
            {loans.map((p) => (
              <LoanCard key={p.id} p={p} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- naik ke tim utama ---------- */

interface Promoted {
  p: AcademyPlayer;
  played: number;
  minutes: number;
  goals: number;
  assists: number | null;
}

/** Pemain skuad akademi yang tercatat bermain untuk tim utama (ESPN). Pencocokan nama ketat: lebih baik terlewat daripada salah orang. */
function promotedFrom(squad: AcademyPlayer[], stats: PlayerStatsResponse | null): Promoted[] {
  if (!stats) return [];
  const out: Promoted[] = [];
  const seen = new Set<string>();
  for (const p of squad) {
    const hits = stats.players.filter((r) => sameNameStrict(r.name, p.name));
    if (hits.length !== 1 || seen.has(hits[0].id)) continue;
    const t = totalsOf(hits[0]);
    if (t.played <= 0) continue;
    seen.add(hits[0].id);
    out.push({ p, played: t.played, minutes: t.minutes, goals: t.goals, assists: t.assists });
  }
  return out.sort((a, b) => b.minutes - a.minutes);
}

/* ---------- halaman ---------- */

export default function AkademiPage() {
  const ak = useFetch<AkademiResponse>('/api/akademi');
  const stats = useFetch<PlayerStatsResponse>('/api/juventus/stats');
  const [tab, setTab] = useState<Tab>('nextgen');
  const d = ak.data;
  const { nextgen, youth } = d ?? { nextgen: null, youth: null };

  const promoted = useMemo(() => promotedFrom(d?.squad ?? [], stats.data), [d, stats.data]);

  const scorers = [
    ...(nextgen?.topScorers.map((s) => ({ ...s, team: 'nextgen' as const })) ?? []),
    ...(youth?.topScorers.map((s) => ({ ...s, team: 'youth' as const })) ?? []),
  ].sort((a, b) => b.goals - a.goals);
  const top = scorers[0] ?? null;
  const topBy = (k: AcademyKey) => (k === 'nextgen' ? nextgen : youth)?.topScorers[0];

  const TeamMetric = ({ t, k, red }: { t: AcademyTeam | null; k: AcademyKey; red?: boolean }) => (
    <div className={`kp-metric${red ? ' kp-metric-red' : ''}`}>
      <div className="kp-metric-label">{[TEAM_LABEL[k], t?.league].filter(Boolean).join(' · ')}</div>
      <div className="kp-metric-val">{t?.position ? `#${t.position}` : '–'}</div>
      <div className="kp-metric-sub">{t ? `${t.points} poin · ${t.record.w}M ${t.record.d}S ${t.record.l}K` : ak.loading ? 'Memuat data…' : 'Data belum tersedia'}</div>
    </div>
  );

  const tabLabel = (k: AcademyKey, t: AcademyTeam | null) => [TEAM_LABEL[k], t?.league].filter(Boolean).join(' · ');

  return (
    <div className="kp" id="akademi">
      <header className="ak-head">
        <h2 className="kp-title">Akademi Juventus</h2>
        <small className="kp-muted">Juventus Next Gen, Juventus Youth (Primavera), dan pemain pinjaman</small>
      </header>

      <div className="kp-metrics">
        <TeamMetric t={nextgen} k="nextgen" red />
        <TeamMetric t={youth} k="youth" />
        <div className="kp-metric">
          <div className="kp-metric-label">Top skor akademi</div>
          <div className="kp-metric-val sq-coach">{top ? `${top.name.split(' ').slice(-1)[0]} ${top.goals}` : '–'}</div>
          <div className="kp-metric-sub">
            {top
              ? (['nextgen', 'youth'] as const)
                  .map((k) => {
                    const s = topBy(k);
                    return s ? `${TEAM_LABEL[k]}: ${s.name.split(' ').slice(-1)[0]} ${s.goals} gol` : '';
                  })
                  .filter(Boolean)
                  .join(' · ')
              : ak.loading
              ? 'Memuat data…'
              : 'Tidak ada di sumber data'}
          </div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Debut tim utama</div>
          <div className="kp-metric-val">{stats.data ? promoted.length : '–'}</div>
          <div className="kp-metric-sub">{stats.data ? (promoted.length ? promoted.slice(0, 3).map((x) => x.p.name.split(' ').slice(-1)[0]).join(', ') + (promoted.length > 3 ? '…' : '') : 'Belum ada') : stats.loading ? 'Memuat data…' : 'Statistik belum tersedia'}</div>
        </div>
      </div>

      {ak.error && <div className="kp-card kp-empty">Data akademi belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div>}
      {d && d.warnings.length > 0 && (
        <div className="kp-card wm-warn">
          {d.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      {promoted.length > 0 && (
        <section className="kp-card ak-panel">
          <header className="kp-card-head">
            <h2 className="kp-title">Naik ke tim utama</h2>
            <small className="kp-muted">Pemain akademi yang sudah tampil untuk tim senior musim ini</small>
          </header>
          <div className="ak-prom">
            {promoted.map(({ p, played, minutes, goals, assists }) => (
              <article className="ak-pcard" key={p.id}>
                <Face src={p.photo} name={p.name} size={56} />
                <b>{p.name}</b>
                <small>{[p.age != null ? `${p.age} th` : '', p.group, TEAM_LABEL[p.team]].filter(Boolean).join(' · ')}</small>
                <div className="ak-tiles ak-tiles-dark">
                  <div>
                    <b>{played}</b>
                    <small>laga tim utama</small>
                  </div>
                  <div>
                    <b>{minutes}&prime;</b>
                    <small>menit</small>
                  </div>
                  <div>
                    <b>{assists == null ? `${goals}` : `${goals}+${assists}`}</b>
                    <small>gol+assist</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="ak-tabs">
        <button type="button" className={`sq-chip${tab === 'nextgen' ? ' active' : ''}`} onClick={() => setTab('nextgen')}>
          {tabLabel('nextgen', nextgen)}
        </button>
        <button type="button" className={`sq-chip${tab === 'youth' ? ' active' : ''}`} onClick={() => setTab('youth')}>
          {tabLabel('youth', youth)}
        </button>
        <button type="button" className={`sq-chip${tab === 'loans' ? ' active' : ''}`} onClick={() => setTab('loans')}>
          Dipinjamkan{d ? ` (${d.loans.length})` : ''}
        </button>
      </div>

      {ak.loading && <div className="kp-card kp-empty">Memuat data akademi…</div>}
      {tab === 'nextgen' && nextgen && <TeamPanel t={nextgen} />}
      {tab === 'youth' && youth && <TeamPanel t={youth} />}
      {tab === 'loans' && d && <LoanPanel loans={d.loans} />}
      {d && ((tab === 'nextgen' && !nextgen) || (tab === 'youth' && !youth)) && <div className="kp-card kp-empty">Data tim ini belum tersedia dari FotMob.</div>}

      <p className="kp-note ak-foot">Sumber: FotMob (tabel, jadwal, hasil, skuad, pemain pinjaman) dan ESPN (penampilan di tim utama). Data tidak resmi dan bisa terlambat diperbarui; pemain pinjaman dihitung dari transfer pinjaman keluar sejak 1 Juni musim berjalan.</p>
    </div>
  );
}
