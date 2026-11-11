'use client';

import { useMemo, useState } from 'react';
import { useFetch } from '@/components/kp';
import { PITCH_L, PITCH_W, type Outcome, type PenyelesaianResponse, type PlayerShooting, type Shot } from '@/lib/penyelesaian';
import './penyelesaian.css';

const dec = (n: number, d = 2) => n.toFixed(d).replace('.', ',');
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${dec(Math.abs(n))}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/* ---------- peta tembakan: separuh lapangan serang, gawang di atas, sedikit perspektif ---------- */

const VB_W = 420;
const VB_H = 352;
const CX = VB_W / 2;
const Y_GOAL = 54; // posisi garis gawang di layar
const Y_BOT = 344; // garis tengah lapangan
const HALF = PITCH_L / 2; // 52,5 m
const W_BOT = 404; // lebar lapangan di garis tengah (px)
const TAPER = 0.85; // lebar garis gawang relatif terhadap garis tengah

/** (u = lebar 0..68, d = jarak dari garis gawang 0..52,5 m) → piksel layar. */
function proj(u: number, d: number): [number, number] {
  const t = d / HALF;
  const s = TAPER + (1 - TAPER) * t;
  return [CX + ((u - PITCH_W / 2) / PITCH_W) * W_BOT * s, Y_GOAL + t * (Y_BOT - Y_GOAL)];
}
const pt = (u: number, d: number) => proj(u, d).map((n) => n.toFixed(1)).join(',');
const poly = (pts: [number, number][]) => pts.map(([u, d]) => pt(u, d)).join(' ');
const line = (pts: [number, number][]) => 'M' + pts.map(([u, d]) => pt(u, d)).join(' L');

const MID = PITCH_W / 2;
const arcPoints = (cu: number, cd: number, r: number, from: number, to: number, keep: (d: number) => boolean) => {
  const out: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const a = from + ((to - from) * i) / 48;
    const p: [number, number] = [cu + r * Math.cos(a), cd + r * Math.sin(a)];
    if (keep(p[1])) out.push(p);
  }
  return out;
};

const STRIPES = Array.from({ length: 8 }, (_, i) => i);
const OUTCOME_LABEL: Record<Outcome, string> = { goal: 'Gol', saved: 'Tepat sasaran', miss: 'Melenceng', blocked: 'Diblok' };

function ShotMap({ shots }: { shots: Shot[] }) {
  const placed = useMemo(
    () =>
      shots
        .map((s) => {
          const d = Math.min(HALF, Math.max(0, PITCH_L - s.x));
          const [x, y] = proj(s.y, d);
          const r = 4.5 + Math.sqrt(Math.max(0, s.xg)) * 14;
          const [gx, gy] = proj(s.goalY ?? MID, 0);
          return { s, x, y, r, gx, gy };
        })
        .sort((a, b) => b.r - a.r), // yang besar digambar dulu, yang kecil tetap kelihatan di atasnya
    [shots]
  );

  return (
    <svg className="pe-pitch" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label="Peta tembakan pemain terpilih">
      <defs>
        <radialGradient id="pe-glow" cx="50%" cy="0%" r="75%">
          <stop offset="0" stopColor="#2a2a2a" />
          <stop offset="1" stopColor="#0a0a0a" />
        </radialGradient>
      </defs>
      <rect width={VB_W} height={VB_H} fill="url(#pe-glow)" />

      {STRIPES.map((i) => {
        const a = (i / STRIPES.length) * HALF;
        const b = ((i + 1) / STRIPES.length) * HALF;
        return <polygon key={i} points={poly([[0, a], [PITCH_W, a], [PITCH_W, b], [0, b]])} fill={i % 2 ? '#1f6a33' : '#237a39'} />;
      })}

      <g className="pe-lines" fill="none">
        <polygon points={poly([[0, 0], [PITCH_W, 0], [PITCH_W, HALF], [0, HALF]])} />
        <polygon points={poly([[MID - 20.16, 0], [MID + 20.16, 0], [MID + 20.16, 16.5], [MID - 20.16, 16.5]])} />
        <polygon points={poly([[MID - 9.16, 0], [MID + 9.16, 0], [MID + 9.16, 5.5], [MID - 9.16, 5.5]])} />
        <path d={line(arcPoints(MID, 11, 9.15, 0, Math.PI, (d) => d > 16.5))} />
        <path d={line(arcPoints(MID, HALF, 9.15, Math.PI, 2 * Math.PI, () => true))} />
        <polygon className="pe-goal" points={poly([[MID - 3.66, 0], [MID + 3.66, 0], [MID + 3.66, -3.2], [MID - 3.66, -3.2]])} />
      </g>
      <circle cx={proj(MID, 11)[0]} cy={proj(MID, 11)[1]} r="1.8" fill="#ffffffcc" />

      {placed
        .filter((p) => p.s.outcome === 'goal')
        .map((p, i) => (
          <line key={`l${i}`} x1={p.x} y1={p.y} x2={p.gx} y2={p.gy} className="pe-goalline" />
        ))}

      {placed.map((p, i) => (
        <g key={i} className={`pe-shot ${p.s.outcome}`}>
          <title>{`${p.s.min}' vs ${p.s.opp} · ${OUTCOME_LABEL[p.s.outcome]} · ${dec(p.s.xg)} xG${p.s.head ? ' · sundulan' : ''}${p.s.penalty ? ' · penalti' : ''}`}</title>
          <circle cx={p.x} cy={p.y} r={p.r} />
          {p.s.outcome === 'blocked' ? (
            <path d={`M${p.x - p.r * 0.45},${p.y - p.r * 0.45} L${p.x + p.r * 0.45},${p.y + p.r * 0.45} M${p.x + p.r * 0.45},${p.y - p.r * 0.45} L${p.x - p.r * 0.45},${p.y + p.r * 0.45}`} />
          ) : null}
        </g>
      ))}
    </svg>
  );
}

/* ---------- gol vs xG ---------- */

function DiffList({ players, selectedId, onPick }: { players: PlayerShooting[]; selectedId: string; onPick: (id: string) => void }) {
  const maxPos = Math.max(0.01, ...players.map((p) => p.diff));
  const maxNeg = Math.max(0.01, ...players.map((p) => -p.diff));
  const span = maxPos + maxNeg;
  const zero = (maxNeg / span) * 100;

  return (
    <div className="pe-diff">
      <h3>Gol dibanding xG</h3>
      <ul>
        {players.map((p) => {
          const w = Math.max(1.2, (Math.abs(p.diff) / span) * 100);
          const left = p.diff >= 0 ? zero : zero - w;
          return (
            <li key={p.id}>
              <button type="button" className={`pe-drow${p.id === selectedId ? ' on' : ''}`} onClick={() => onPick(p.id)}>
                <div className="pe-dwho">
                  <b>{p.name.split(' ').slice(-1)[0]}</b>
                  <small>
                    {p.goals} G · {dec(p.xg, 1)} xG
                  </small>
                </div>
                <div className="pe-track" aria-hidden="true">
                  <i className={p.diff >= 0 ? 'pos' : 'neg'} style={{ left: `${left}%`, width: `${w}%` }} />
                  <em style={{ left: `${zero}%` }} />
                </div>
                <span className={`pe-dval ${p.diff >= 0 ? 'pos' : 'neg'}`}>{signed(p.diff)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="pe-legend-note">Kanan (hijau) = mencetak lebih banyak dari perkiraan, kiri (merah) = di bawah perkiraan.</p>
    </div>
  );
}

/** Statistik → Analitik → 02 Penyelesaian (peta tembakan + gol vs xG per pemain Juventus). */
export default function Penyelesaian() {
  const [comp, setComp] = useState('all');
  const [pick, setPick] = useState('');
  const res = useFetch<PenyelesaianResponse>(`/api/analitik/penyelesaian?comp=${encodeURIComponent(comp)}`);
  const d = res.data;
  const player = d?.players.find((p) => p.id === pick) ?? d?.players[0];

  return (
    <section className="pe">
      <header className="pe-head">
        <span className="pe-num">02</span>
        <h2>PENYELESAIAN</h2>
        <small>Peta tembakan &amp; gol vs xG per pemain</small>
      </header>

      {d && d.competitions.length > 1 ? (
        <div className="pe-pills" role="tablist" aria-label="Kompetisi">
          {[{ id: 'all', name: 'Semua' }, ...d.competitions].map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={comp === c.id} className={`pe-pill${comp === c.id ? ' on' : ''}`} onClick={() => setComp(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      {res.loading ? <div className="pe-empty">Memuat peta tembakan… (pertama kali bisa beberapa detik)</div> : null}
      {!res.loading && (res.error || !d) ? <div className="pe-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && !res.loading ? (
        !player ? (
          <div className="pe-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
        ) : (
          <>
            <div className="pe-body">
              <div className="pe-left">
                <label className="pe-select">
                  <span>Pemain</span>
                  <select value={player.id} onChange={(e) => setPick(e.target.value)}>
                    {d.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <ShotMap shots={player.shots} />
                <ul className="pe-legend">
                  <li><i className="goal" />Gol</li>
                  <li><i className="saved" />Tepat sasaran</li>
                  <li><i className="miss" />Melenceng</li>
                  <li><i className="blocked" />Diblok</li>
                  <li className="sz">
                    <i className="s1" />
                    <i className="s2" />
                    <i className="s3" />
                    Ukuran = xG
                  </li>
                </ul>
              </div>

              <div className="pe-stats">
                <div className="pe-stat"><b>{player.goals}</b><span>gol</span></div>
                <div className="pe-stat"><b>{dec(player.xg)}</b><span>xG</span></div>
                <div className="pe-stat"><b className={player.diff >= 0 ? 'pos' : 'neg'}>{signed(player.diff)}</b><span className={player.diff >= 0 ? 'pos' : 'neg'}>gol − xG</span></div>
                <div className="pe-stat"><b>{player.total}</b><span>tembakan</span></div>
                <div className="pe-stat"><b>{pct(player.onTargetPct)}</b><span>tepat sasaran</span></div>
                <div className="pe-stat"><b>{pct(player.inBoxPct)}</b><span>dari dalam kotak</span></div>
                <div className="pe-stat"><b>{dec(player.xgPerShot)}</b><span>xG per tembakan</span></div>
                <div className="pe-stat"><b>{player.headers}</b><span>sundulan</span></div>
              </div>

              <DiffList players={d.players} selectedId={player.id} onPick={setPick} />
            </div>

            <p className="pe-note">
              Posisi tembakan dan xG per tembakan dari peta tembakan FotMob (data Opta), {d.matches} laga; minimal {d.minShots} tembakan. Penalti ikut dihitung, gol bunuh diri tidak.
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
