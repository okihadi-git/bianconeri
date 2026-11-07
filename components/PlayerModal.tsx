'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFetch } from '@/components/kp';
import { fmtEuro, fmtMonthYear } from '@/components/team';
import { countryId, flagUrl, shortCode } from '@/lib/countries';
import type { PlayerDetail, FormEntry } from '@/lib/player';
import { ageAt, buildProfile, fmtDateId, positionId, seasonsLeft, summarize, trend, type Axis } from '@/lib/playerprofile';
import type { PlayerStatsResponse } from '@/lib/playerstats';
import { salaryFrom, weeklyOf, yearlyOf, type SalaryResponse } from '@/lib/salaries';
import type { SquadPlayer } from '@/lib/types';
import './player-modal.css';

export interface StatsState {
  data: PlayerStatsResponse | null;
  loading: boolean;
  error: boolean;
}

const dec = (n: number, d = 1) => n.toFixed(d).replace('.', ',');
const initials = (n: string) => {
  const t = n.trim().split(/\s+/).filter(Boolean);
  return (t.length < 2 ? (t[0] ?? '?').slice(0, 2) : t[0][0] + t[t.length - 1][0]).toUpperCase();
};

/** Musim berjalan, mis. "2026/27" (musim Juli–Juni) */
function seasonLabel(now: Date) {
  const end = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  return `${end - 1}/${String(end).slice(2)}`;
}

/* ---------- potongan kecil ---------- */

function Photo({ src, name }: { src: string; name: string }) {
  const [bad, setBad] = useState(false);
  return src && !bad ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="pm-photo" src={src} alt="" onError={() => setBad(true)} />
  ) : (
    <span className="pm-photo pm-photo-ph">{initials(name)}</span>
  );
}

function Flag({ country }: { country: string }) {
  const [bad, setBad] = useState(false);
  const url = flagUrl(country);
  if (!url || bad) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="pm-flag" src={url} alt="" width={20} height={14} onError={() => setBad(true)} />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pm-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="pm-sec">
      <h4 className="pm-h">
        {title}
        {note && <span>{note}</span>}
      </h4>
      {children}
    </section>
  );
}

/* ---------- grafik ---------- */

/** Rating 10 laga terakhir: garis rating, titik oranye = di bawah rata-rata, batang abu-abu = menit bermain. */
function FormChart({ form }: { form: FormEntry[] }) {
  const rated = form.filter((f) => f.rating != null);
  if (!rated.length) return <p className="pm-muted">Belum ada rating laga.</p>;

  const W = 480;
  const H = 150;
  const padX = 22;
  const top = 12;
  const base = 108; // dasar area garis
  const ratings = rated.map((f) => f.rating as number);
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const lo = Math.min(5, Math.floor(Math.min(...ratings) - 0.5));
  const hi = Math.max(8, Math.ceil(Math.max(...ratings) + 0.5));
  const x = (i: number) => (form.length === 1 ? W / 2 : padX + (i * (W - padX * 2)) / (form.length - 1));
  const y = (r: number) => base - ((r - lo) / (hi - lo)) * (base - top);

  const pts = form.map((f, i) => (f.rating == null ? null : { i, f, cx: x(i), cy: y(f.rating) }));
  const path = pts.filter(Boolean).map((p, k) => `${k ? 'L' : 'M'}${p!.cx.toFixed(1)},${p!.cy.toFixed(1)}`).join(' ');
  const maxMin = Math.max(90, ...form.map((f) => f.minutes));
  const t = trend(ratings);

  return (
    <>
      <svg className="pm-form" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rating ${rated.length} laga terakhir, rata-rata ${dec(avg, 2)}`}>
        {Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).map((v) => (
          <g key={v}>
            <line x1={padX - 6} x2={W - padX + 6} y1={y(v)} y2={y(v)} className="pm-grid" />
            <text x={4} y={y(v) + 3} className="pm-axis">
              {v}
            </text>
          </g>
        ))}
        <line x1={padX - 6} x2={W - padX + 6} y1={y(avg)} y2={y(avg)} className="pm-avg" />
        {form.map((f, i) => (
          <rect key={`b${f.id || i}`} x={x(i) - 7} width={14} y={H - 20 - (f.minutes / maxMin) * 14} height={(f.minutes / maxMin) * 14} rx={2} className="pm-bar">
            <title>{`${f.minutes} menit`}</title>
          </rect>
        ))}
        <path d={path} className="pm-line" />
        {pts.map(
          (p) =>
            p && (
              <circle key={p.f.id || p.i} cx={p.cx} cy={p.cy} r={4.5} className={(p.f.rating as number) < avg ? 'pm-dot low' : 'pm-dot'}>
                <title>{`${p.f.oppName} · ${dec(p.f.rating as number)} · ${p.f.minutes}′`}</title>
              </circle>
            )
        )}
        {form.map((f, i) => (
          <text key={`t${f.id || i}`} x={x(i)} y={H - 2} textAnchor="middle" className="pm-axis">
            {f.opp}
          </text>
        ))}
      </svg>
      <p className="pm-note">
        Garis putus = rata-rata {rated.length} laga {dec(avg, 2)}. Batang abu-abu = menit bermain. Titik oranye = di bawah rata-rata.
        {t && <b className={`pm-trend ${t}`}> {t}</b>}
      </p>
    </>
  );
}

/** Radar persentil; sumbu tanpa data digambar di titik 0 dan diberi tanda "–" di daftar. */
function Radar({ axes }: { axes: Axis[] }) {
  const cx = 110;
  const cy = 100;
  const R = 58;
  const n = axes.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => `${(cx + Math.cos(ang(i)) * r).toFixed(1)},${(cy + Math.sin(ang(i)) * r).toFixed(1)}`;
  const ring = (f: number) => axes.map((_, i) => pt(i, R * f)).join(' ');
  const shape = axes.map((a, i) => pt(i, R * ((a.pct ?? 0) / 100))).join(' ');
  return (
    <svg className="pm-radar" viewBox="-36 0 292 200" role="img" aria-label="Radar profil statistik">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} className="pm-ring" />
      ))}
      {axes.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={pt(i, R).split(',')[0]} y2={pt(i, R).split(',')[1]} className="pm-ring" />
      ))}
      <polygon points={shape} className="pm-shape" />
      {axes.map((a, i) => {
        const [lx, ly] = pt(i, R + 10).split(',').map(Number);
        return (
          <text key={a.key} x={lx} y={ly + 3} textAnchor={Math.abs(lx - cx) < 6 ? 'middle' : lx < cx ? 'end' : 'start'} className="pm-axis">
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ---------- popup ---------- */

export default function PlayerModal({ player, stats, source, onClose }: { player: SquadPlayer; stats: StatsState; source: string; onClose: () => void }) {
  const detailRes = useFetch<PlayerDetail>(`/api/player?name=${encodeURIComponent(player.name)}`);
  const detail = detailRes.data;
  const salaryRes = useFetch<SalaryResponse>('/api/gaji');
  const closeRef = useRef<HTMLButtonElement>(null);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const summary = useMemo(() => summarize(player.name, stats.data), [player.name, stats.data]);
  const found = Boolean(summary?.row.id);
  const profile = useMemo(() => (summary && found && stats.data ? buildProfile(summary.row, stats.data) : null), [summary, found, stats.data]);

  const nations = player.nation.length ? player.nation : detail?.country ? [detail.country] : [];
  const code = shortCode(nations[0]);
  const position = positionId(player.position || detail?.position);
  const heightCm = player.heightCm ?? detail?.heightCm ?? null;
  const age = ageAt(detail?.birth.iso ?? null, now) ?? player.age;
  const value = player.marketValue ?? detail?.marketValue ?? null;
  const salary = salaryFrom(salaryRes.data?.salaries, { name: player.name, ids: { tm: source === 'Transfermarkt' ? player.id : null, fotmob: source === 'FotMob' ? player.id : detail?.id } });
  const yearly = salary ? yearlyOf(salary) : null;
  const weekly = salary ? weeklyOf(salary) : null;
  const k = (n: number) => Math.round(n / 1000) * 1000;
  const left = seasonsLeft(player.contractUntil, now);
  const segments = Math.max(5, left);

  const stat = (v: number | null | undefined) => (stats.loading ? '…' : !found || v == null ? '–' : String(v));
  const t = summary?.totals;

  const detailPending = detailRes.loading;
  const dash = detailPending ? '…' : '–';

  return createPortal(
    <div className="pm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="pm" role="dialog" aria-modal="true" aria-label={`Profil ${player.name}`}>
        <header className="pm-head">
          <Photo src={player.photo} name={player.name} />
          <div className="pm-id">
            <span className="pm-num">{player.jersey || ''}</span>
            <h3>{player.name}</h3>
            <small>
              {[code, position, age != null ? `${age} th` : ''].filter(Boolean).join(' · ')}
              {player.captain ? ' · Kapten' : ''}
            </small>
          </div>
          <button ref={closeRef} className="pm-x" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>

        <div className="pm-body">
          <dl className="pm-info">
            <Row label="Negara">
              {nations.length ? (
                nations.map((n, i) => (
                  <span key={n} className="pm-nat">
                    {i > 0 && ' / '}
                    <Flag country={n} />
                    <b>{countryId(n)}</b>
                  </span>
                ))
              ) : (
                '–'
              )}
            </Row>
            <Row label="Lahir">
              {detail?.birth.iso ? (
                <>
                  <b>
                    {fmtDateId(detail.birth.iso)}
                    {age != null ? ` (${age} th)` : ''}
                  </b>
                  {detail.birth.place && <span className="pm-sub">{detail.birth.place}</span>}
                </>
              ) : (
                <>{age != null ? <b>{age} th</b> : dash}</>
              )}
            </Row>
            <Row label="Tinggi">{heightCm ? <b>{heightCm} cm</b> : dash}</Row>
            <Row label="Bergabung">
              {detail?.joined?.year ? (
                <b>
                  {detail.joined.year}
                  {detail.joined.from ? ` dari ${detail.joined.from}` : ''}
                </b>
              ) : (
                dash
              )}
            </Row>
            <Row label="Gaji">
              {salary && (weekly ?? yearly) != null ? (
                <>
                  <b>{weekly != null ? `${fmtEuro(k(weekly))}/pekan` : `${fmtEuro(yearly)}/tahun`}</b>
                  {weekly != null && yearly != null && <span className="pm-muted"> (±{fmtEuro(yearly)}/tahun)</span>}
                  {salary.bonusPerYear != null && <span className="pm-sub">Termasuk bonus ±{fmtEuro(salary.bonusPerYear)}/tahun</span>}
                </>
              ) : (
                <span className="pm-muted">{salaryRes.loading ? '…' : 'Tidak tersedia'}</span>
              )}
            </Row>
            <Row label="Kontrak">{player.contractUntil ? <b>hingga {fmtMonthYear(player.contractUntil)}</b> : '–'}</Row>
            <Row label="Nilai transfer">
              {value ? (
                <>
                  <b>{fmtEuro(value)}</b> <span className="pm-muted">(estimasi {source})</span>
                </>
              ) : (
                '–'
              )}
            </Row>
            {salary?.releaseClause != null && <Row label="Klausul rilis"><b>{fmtEuro(salary.releaseClause)}</b></Row>}
            <Row label="Status">
              {detail ? (
                detail.injury ? (
                  <b className="pm-bad">
                    Cedera · {detail.injury.name}
                    {` (kembali: ${detail.injury.returns ?? 'TBC'})`}
                  </b>
                ) : (
                  <b>Siap main</b>
                )
              ) : (
                dash
              )}
            </Row>
          </dl>

          <div className="pm-stats">
            <div>
              <b>{stat(summary?.leagueStarts)}</b>
              <small>Starter liga</small>
            </div>
            <div>
              <b>{stat(t?.goals)}</b>
              <small>Gol</small>
            </div>
            <div>
              <b>{stat(t?.assists)}</b>
              <small>Assist</small>
            </div>
            <div>
              <b>{stat(t?.yellow)}</b>
              <small>Kartu kuning*</small>
            </div>
          </div>

          {detail?.nationalTeam && (
            <Section title="Timnas">
              <p className="pm-line">
                <b>{countryId(detail.nationalTeam.team)}</b> · {detail.nationalTeam.caps ?? '–'} caps, {detail.nationalTeam.goals ?? '–'} gol <span className="pm-muted">(data FotMob)</span>
              </p>
            </Section>
          )}

          {detail && detail.clubs.length > 0 && (
            <Section title="Riwayat klub">
              <ol className="pm-clubs">
                {detail.clubs.map((c, i) => (
                  <li key={`${c.team}-${i}`} className={c.current ? 'cur' : ''}>
                    <span>{c.years}</span>
                    <b>
                      {c.team}
                      {c.loan ? ' (pinjaman)' : ''}
                    </b>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {detail && detail.form.length > 0 && (
            <Section title={`Form ${detail.form.length} laga terakhir`} note="rating FotMob">
              <FormChart form={detail.form} />
            </Section>
          )}

          <Section title="Profil statistik" note={profile ? `persentil di antara ${profile.peers} ${profile.group.toLowerCase()} Juventus (min. 180 menit)` : undefined}>
            {stats.loading ? (
              <p className="pm-muted">Memuat statistik…</p>
            ) : stats.error || !stats.data ? (
              <p className="pm-muted">Statistik pemain belum bisa dimuat.</p>
            ) : !found ? (
              <p className="pm-muted">Pemain ini belum tercatat bermain di laga resmi musim ini.</p>
            ) : !profile ? (
              <p className="pm-muted">Belum cukup menit bermain (minimal 180 menit) untuk dibandingkan dengan rekan seposisi.</p>
            ) : (
              <div className="pm-prof">
                <Radar axes={profile.axes} />
                <ul className="pm-pct">
                  {profile.axes.map((a) => (
                    <li key={a.key}>
                      <span>{a.label}</span>
                      <i>
                        <u style={{ width: `${a.pct ?? 0}%` }} />
                      </i>
                      <b>{a.pct ?? '–'}</b>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="Kebugaran & cedera">
            {detail ? (
              detail.injury ? (
                <p className="pm-alert">
                  <b>Cedera:</b> {detail.injury.name}. Perkiraan kembali: {detail.injury.returns ?? 'belum diketahui'}.
                </p>
              ) : (
                <p className="pm-ok">✅ Tidak ada cedera yang dilaporkan saat ini.</p>
              )
            ) : (
              <p className="pm-muted">{detailPending ? 'Memuat status cedera…' : 'Status cedera tidak tersedia dari sumber data.'}</p>
            )}
            {summary && found && summary.matchesTotal > 0 && t && (
              <p className="pm-line">
                Tampil di <b>{t.played}</b> dari {summary.matchesTotal} laga resmi musim ini · tidak bermain di {Math.max(0, summary.matchesTotal - t.played)} laga (cedera, rotasi, atau tidak dipilih).
              </p>
            )}
          </Section>

          <Section title="Kontrak & nilai pasar">
            {player.contractUntil ? (
              <>
                <p className="pm-line">
                  Kontrak sampai <b>{fmtMonthYear(player.contractUntil)}</b> · {left > 0 ? `sisa ${left} musim` : 'sudah berakhir'}
                </p>
                <div className="pm-seg" aria-hidden="true">
                  {Array.from({ length: segments }, (_, i) => (
                    <i key={i} className={i < left ? 'on' : ''} />
                  ))}
                </div>
              </>
            ) : (
              <p className="pm-muted">Tanggal kontrak tidak tersedia dari sumber data.</p>
            )}
            <div className="pm-money">
              <div>
                <b>{weekly != null ? fmtEuro(k(weekly)) : '–'}</b>
                <small>gaji/pekan</small>
              </div>
              <div>
                <b>{yearly != null ? fmtEuro(yearly) : '–'}</b>
                <small>per tahun</small>
              </div>
              <div>
                <b>{fmtEuro(value)}</b>
                <small>nilai pasar</small>
              </div>
            </div>
          </Section>

          <p className="pm-foot">
            Statistik semua kompetisi musim {seasonLabel(now)}, kecuali starter (hanya liga) · *kartu yang sudah terkonfirmasi di laga selesai. Statistik dari ESPN; rating, riwayat klub, dan caps dari FotMob; tempat
            lahir dari Wikidata; nilai transfer dan kontrak dari {source}. Gaji kotor dari database proyek ini{salary?.source ? ` (sumber: ${salary.source})` : ''}. Angka yang tidak diberikan sumber ditampilkan “–”.
          </p>
        </div>
      </aside>
    </div>,
    document.body
  );
}
