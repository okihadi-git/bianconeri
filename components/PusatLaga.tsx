'use client';

import { useEffect, useState } from 'react';
import { useFetch } from '@/components/kp';
import type { LagaDetail, LagaListItem } from '@/lib/pusatlaga-server';
import type { Outcome, Shot } from '@/lib/pusatlaga';
import './pusatlaga.css';

const JUVE = '#d81e3a';
const OPP = '#2b3a8f';
const f2 = (n: number) => n.toFixed(2);
const OUTCOME: Record<Outcome, string> = { goal: 'Gol', saved: 'Tepat sasaran (ditahan kiper)', missed: 'Melenceng', post: 'Kena tiang/mistar', blocked: 'Diblok' };

function Logo({ src, size = 28 }: { src: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="pl-logo" width={size} height={size} /> : <span className="pl-logo" style={{ width: size, height: size }} />;
}

/* ---------- momentum ---------- */

function Momentum({ d }: { d: LagaDetail }) {
  const W = 1000;
  const H = 270;
  const L = 36;
  const R = 36;
  const mid = H / 2;
  const N = d.momentum.bars.length;
  const x = (m: number) => L + ((m - 1) / (N - 1)) * (W - L - R);
  const bw = ((W - L - R) / N) * 0.86;
  const amp = mid - 26;
  const ticks = [15, 30, 45, 60, 75, 90].filter((t) => t <= N);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-svg" role="img" aria-label="Momentum serangan per menit">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={14} y2={H - 14} className="pl-vgrid" />
          <text x={x(t)} y={mid + 14} textAnchor="middle" className="pl-axis">{t}&apos;</text>
        </g>
      ))}
      {d.momentum.bars.map((b) => (
        <g key={b.minute}>
          {b.juve > 0.01 && <rect x={x(b.minute) - bw / 2} y={mid - b.juve * amp} width={bw} height={b.juve * amp} fill={JUVE} />}
          {b.opp > 0.01 && <rect x={x(b.minute) - bw / 2} y={mid} width={bw} height={b.opp * amp} fill={OPP} />}
        </g>
      ))}
      <line x1={L} x2={W - R} y1={mid} y2={mid} className="pl-mid" />
      {d.goals.map((g, i) => (
        <g key={i}>
          <line x1={x(Math.max(1, Math.min(N, g.minute)))} x2={x(Math.max(1, Math.min(N, g.minute)))} y1={22} y2={H - 14} className="pl-goalline" />
          <circle cx={x(Math.max(1, Math.min(N, g.minute)))} cy={16} r={8} fill={g.team === 'juve' ? JUVE : OPP} stroke="#fff" strokeWidth={2}>
            <title>{`${g.minute}' ${g.player}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}

/* ---------- peluang menang ---------- */

function WinProb({ d }: { d: LagaDetail }) {
  const W = 1000;
  const H = 190;
  const L = 36;
  const R = 36;
  const T = 8;
  const B = 22;
  const x = (t: number) => L + (t / 90) * (W - L - R);
  const y = (p: number) => H - B - p * (H - T - B);
  const pts = d.winProb;
  const area = (lo: (p: (typeof pts)[number]) => number, hi: (p: (typeof pts)[number]) => number) =>
    `M${x(pts[0].t)},${y(lo(pts[0]))} ` + pts.map((p) => `L${x(p.t)},${y(hi(p))}`).join(' ') + ' ' + [...pts].reverse().map((p) => `L${x(p.t)},${y(lo(p))}`).join(' ') + ' Z';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-svg" role="img" aria-label="Peluang menang per menit">
      <path d={area(() => 0, (p) => p.juve)} fill="#e0212f" />
      <path d={area((p) => p.juve, (p) => p.juve + p.draw)} fill="#c5c9d6" />
      <path d={area((p) => p.juve + p.draw, () => 1)} fill="#4a5a9a" />
      <line x1={L} x2={W - R} y1={y(0.5)} y2={y(0.5)} className="pl-dash" />
      {[45, 90].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={T} y2={H - B} className="pl-dash" />
          <text x={x(t)} y={H - 6} textAnchor="middle" className="pl-axis">{t}&apos;</text>
        </g>
      ))}
      {d.goals.map((g, i) => (
        <circle key={i} cx={x(Math.min(90, g.minute))} cy={H - B - 2} r={7} fill={g.team === 'juve' ? JUVE : OPP} stroke="#fff" strokeWidth={2}>
          <title>{`${g.minute}' ${g.player}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/* ---------- peta tembakan ---------- */

function ShotMap({ d }: { d: LagaDetail }) {
  const r = (s: Shot) => 0.9 + Math.sqrt(s.xg) * 3.4;
  return (
    <div className="pl-pitchwrap">
      <svg viewBox="0 0 105 68" className="pl-pitch" role="img" aria-label="Peta tembakan">
        <rect width="105" height="68" fill="#2f9e57" />
        {Array.from({ length: 7 }, (_, i) => (i % 2 ? <rect key={i} x={i * 15} width="15" height="68" fill="#2a914f" /> : null))}
        <g fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.3">
          <rect x="0.3" y="0.3" width="104.4" height="67.4" />
          <line x1="52.5" y1="0.3" x2="52.5" y2="67.7" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="0.3" y="13.84" width="16.5" height="40.32" />
          <rect x="88.2" y="13.84" width="16.5" height="40.32" />
          <rect x="0.3" y="24.84" width="5.5" height="18.32" />
          <rect x="99.2" y="24.84" width="5.5" height="18.32" />
        </g>
        {d.shots.map((s, i) => {
          const fill = s.outcome === 'goal' ? '#ffc72c' : s.outcome === 'blocked' ? '#555a66' : s.onTarget ? (s.team === 'juve' ? JUVE : '#5b7be0') : 'transparent';
          const stroke = s.outcome === 'goal' ? '#1a1a1a' : '#ffffff';
          return (
            <circle key={i} cx={s.x} cy={s.y} r={s.outcome === 'goal' ? Math.max(2.2, r(s)) : r(s)} fill={fill} stroke={stroke} strokeWidth={s.outcome === 'goal' ? 0.5 : 0.35} fillOpacity={0.92}>
              <title>{`${s.minute}'${s.added ? `+${s.added}` : ''} ${s.player} · ${OUTCOME[s.outcome]} · xG ${f2(s.xg)}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- halaman ---------- */

export default function PusatLaga() {
  const list = useFetch<{ matches: LagaListItem[] }>('/api/laga');
  const matches = list.data?.matches ?? [];
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    if (!sel && matches.length) setSel(`${matches[0].id}|${matches[0].league}`);
  }, [matches, sel]);
  const [id, league] = (sel ?? '').split('|');
  const res = useFetch<LagaDetail>(sel ? `/api/laga?id=${id}&league=${encodeURIComponent(league)}` : null);
  const d = res.data;
  const final = d?.winProb[d.winProb.length - 1];

  return (
    <section className="kp-card pl">
      <header className="kp-card-head">
        <h2 className="kp-title">Pusat laga</h2>
        <small className="kp-muted">Momentum serangan, peta tembakan, xG per tembakan, dan peluang menang per menit</small>
      </header>

      <div className="pl-pick">
        <label htmlFor="pl-sel">PILIH LAGA</label>
        <select id="pl-sel" value={sel ?? ''} onChange={(e) => setSel(e.target.value)} disabled={!matches.length}>
          {matches.map((m) => (
            <option key={m.id} value={`${m.id}|${m.league}`}>{m.label}</option>
          ))}
        </select>
      </div>

      {list.loading && <div className="kp-empty">Memuat daftar laga…</div>}
      {!list.loading && (list.error || !matches.length) && <div className="kp-empty">Belum ada laga Juventus yang selesai atau daftar laga belum bisa dimuat dari ESPN.</div>}
      {sel && res.loading && <div className="kp-empty">Menganalisis laga…</div>}
      {sel && !res.loading && (res.error || !d) && <div className="kp-empty">Data laga ini belum tersedia dari ESPN. Coba laga lain atau muat ulang nanti.</div>}

      {d && (
        <>
          <div className="pl-banner">
            <div className="pl-bteam"><Logo src={d.juve.logo} size={38} /><b>{d.juve.name}</b></div>
            <div className="pl-bscore">
              <strong>{d.juve.score}-{d.opp.score}</strong>
              <small>{d.statusText} · {d.competition}</small>
            </div>
            <div className="pl-bteam right"><b>{d.opp.name}</b><Logo src={d.opp.logo} size={38} /></div>
          </div>

          <div className="pl-stats">
            <Logo src={d.juve.logo} size={34} />
            <dl>
              {([
                ['XG', f2(d.stats.xg[0]), f2(d.stats.xg[1])],
                ['TEMBAKAN', d.stats.shots[0], d.stats.shots[1]],
                ['TEPAT SASARAN', d.stats.onTarget[0], d.stats.onTarget[1]],
                ['PELUANG EMAS', d.stats.bigChances[0], d.stats.bigChances[1]],
              ] as [string, string | number, string | number][]).map(([k, a, b]) => (
                <div key={k}>
                  <dd className="j">{a}</dd>
                  <dt>{k}</dt>
                  <dd className="o">{b}</dd>
                </div>
              ))}
            </dl>
            <Logo src={d.opp.logo} size={34} />
          </div>

          {d.hasCommentary && (
            <section className="pl-card">
              <header>
                <h3>Momentum serangan</h3>
                {d.momentum.juveShare !== null && (
                  <small>{d.momentum.juveShare >= 0.5 ? d.juve.name : d.opp.name} menguasai {Math.round(Math.max(d.momentum.juveShare, 1 - d.momentum.juveShare) * 100)}% tekanan</small>
                )}
              </header>
              <Momentum d={d} />
              <p className="pl-legend">
                <i style={{ background: JUVE }} /> {d.juve.name} menekan · <i style={{ background: OPP }} /> {d.opp.name} menekan · dihitung dari tembakan (bobot xG), sepak pojok, tendangan bebas di sepertiga akhir, dan offside per menit
              </p>
            </section>
          )}

          <section className="pl-card">
            <header>
              <h3>Peluang menang sepanjang laga</h3>
              {final && (
                <div className="pl-pills">
                  <span style={{ background: '#e0212f' }}>{d.juve.name} {Math.round(final.juve * 100)}%</span>
                  <span style={{ background: '#8a93ab' }}>Seri {Math.round(final.draw * 100)}%</span>
                  <span style={{ background: '#2b3a8f' }}>{d.opp.name} {Math.round(final.opp * 100)}%</span>
                </div>
              )}
            </header>
            <WinProb d={d} />
            <p className="pl-legend">Model Poisson: kekuatan tim dari {d.priorLabel} lalu digeser oleh xG yang tercipta di laga ini, dihitung ulang tiap menit dari skor dan sisa waktu.</p>
          </section>

          {d.hasCommentary && (
            <section className="pl-card">
              <header>
                <h3>Peta tembakan</h3>
                <small>← {d.opp.name} menyerang · {d.juve.name} menyerang →</small>
              </header>
              <ShotMap d={d} />
              <p className="pl-legend">
                <i className="dot" style={{ background: '#ffc72c' }} /> Gol · <i className="dot" style={{ background: JUVE }} /> Tepat sasaran · <i className="dot ring" /> Melenceng / kena tiang ·{' '}
                <i className="dot" style={{ background: '#555a66' }} /> Diblok · Besar lingkaran = xG
              </p>
            </section>
          )}

          {d.shots.length > 0 && (
            <details className="pl-all">
              <summary>Semua tembakan ({d.shots.length})</summary>
              <table>
                <thead>
                  <tr><th>Menit</th><th className="l">Tim</th><th className="l">Pemain</th><th className="l">Hasil</th><th>xG</th><th className="l">Jenis</th></tr>
                </thead>
                <tbody>
                  {[...d.shots].sort((a, b) => a.minute + a.added / 10 - (b.minute + b.added / 10)).map((s, i) => (
                    <tr key={i}>
                      <td>{s.minute}&apos;{s.added ? `+${s.added}` : ''}</td>
                      <td className="l"><Logo src={s.team === 'juve' ? d.juve.logo : d.opp.logo} size={18} /></td>
                      <td className="l">{s.player}</td>
                      <td className="l">{OUTCOME[s.outcome]}</td>
                      <td>{f2(s.xg)}</td>
                      <td className="l">{s.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          {d.warnings.map((w) => (
            <p key={w} className="pl-warn">{w}</p>
          ))}
          <p className="pl-foot">
            {d.stats.xgOfficial ? 'Total xG tiap tim disamakan dengan xG resmi ESPN; ' : 'xG adalah estimasi; '}pembagian per tembakan diperkirakan dari lokasi yang disebut komentar Opta. Posisi titik pada peta adalah perkiraan zona, bukan koordinat persis. Peluang
            emas = tembakan dengan xG 0,3 atau lebih. Momentum dan peluang menang adalah model, bukan data resmi.
          </p>
        </>
      )}
    </section>
  );
}
