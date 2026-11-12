'use client';

import { useMemo, useState } from 'react';
import { useFetch } from '@/components/kp';
import type { JFixture, JTeam } from '@/lib/jadwal';
import { EASY_AT, HARD_BELOW, LEVEL_LABEL, defaultRival } from '@/lib/jadwal-ui';
import type { JadwalResponse } from '@/lib/jadwal-server';
import { shortDate } from '@/lib/wib';
import './kesulitan.css';

const dec = (n: number, d = 2) => n.toFixed(d).replace('.', ',');

function Logo({ src, size = 22 }: { src: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="kj-logo" width={size} height={size} loading="lazy" /> : <span className="kj-logo kj-nologo" style={{ width: size, height: size }} />;
}

function Row({ f }: { f: JFixture }) {
  return (
    <li className="kj-row">
      <Logo src={f.oppLogo} size={26} />
      <div className="kj-main">
        <b>
          {f.home ? 'vs' : 'di'} {f.oppName} {f.oppPos != null && <small>#{f.oppPos}</small>}
        </b>
        <span>
          {shortDate(f.iso)} · menang {Math.round(f.win * 100)}%
        </span>
      </div>
      <div className="kj-side">
        <span className={`kj-chip kj-${f.level}`}>{LEVEL_LABEL[f.level]}</span>
        <small>{dec(f.xpts)} xPts</small>
      </div>
    </li>
  );
}

function Column({ team }: { team: JTeam }) {
  return (
    <div className="kj-col">
      <h3 className="kj-team">
        <Logo src={team.logo} size={24} />
        {team.name} · #{team.position}
      </h3>
      {team.fixtures.length ? (
        <ul className="kj-list">
          {team.fixtures.map((f) => (
            <Row key={f.id} f={f} />
          ))}
        </ul>
      ) : (
        <p className="kj-none">Belum ada laga Serie A berikutnya di jadwal ESPN.</p>
      )}
      {team.fixtures.length > 0 && (
        <p className="kj-total">
          Perkiraan poin {team.fixtures.length} laga: <b>{dec(team.xpts, 1)}</b> dari {team.max}
        </p>
      )}
    </div>
  );
}

export default function KesulitanJadwal() {
  const res = useFetch<JadwalResponse>('/api/analisa/jadwal');
  const d = res.data;
  const [rivalId, setRivalId] = useState('');

  const juve = d?.teams.find((t) => t.id === d.juveId) ?? null;
  const rival = useMemo(() => {
    if (!d) return null;
    const id = rivalId && rivalId !== d.juveId ? rivalId : defaultRival(d.teams, d.juveId);
    return d.teams.find((t) => t.id === id) ?? null;
  }, [d, rivalId]);

  if (res.loading) return <div className="kp-card kp-empty">Memuat kesulitan jadwal…</div>;
  if (res.error || !d) return <div className="kp-card kp-empty">Klasemen dan jadwal Serie A belum bisa dimuat dari ESPN. Coba muat ulang beberapa saat lagi.</div>;
  if (!juve) return <div className="kp-card kp-empty">{d.warnings[0] ?? 'Juventus tidak ditemukan di klasemen Serie A.'}</div>;

  return (
    <section className="kp-card kj">
      <header className="kp-card-head">
        <h2 className="kp-title">Kesulitan jadwal</h2>
        <small className="kp-muted">
          {d.horizon} laga liga ke depan, Juventus vs rival
        </small>
      </header>

      <div className="kj-pick">
        <label>
          Bandingkan dengan{' '}
          <select value={rival?.id ?? ''} onChange={(e) => setRivalId(e.target.value)}>
            {d.teams
              .filter((t) => t.id !== d.juveId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (#{t.position})
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="kj-cols">
        <Column team={juve} />
        {rival && <Column team={rival} />}
      </div>

      {d.others.length > 0 && (
        <p className="kj-others">
          Di sela laga liga itu Juventus juga main <b>{d.others.length} laga lain</b>:{' '}
          {d.others.map((o, i) => (
            <span key={o.id} title={o.competition}>
              {o.opponent} ({shortDate(o.iso)}){i < d.others.length - 1 ? ', ' : '.'}
            </span>
          ))}
        </p>
      )}
      {d.warnings.length > 0 && <p className="kj-warn">{d.warnings.join(' ')}</p>}

      <p className="kj-note">
        <b>xPts</b> = perkiraan poin dari model Poisson (3 × peluang menang + peluang seri), memperhitungkan kandang/tandang. <b>Mudah</b> ≥ {dec(EASY_AT, 1)} · <b>Sedang</b> {dec(HARD_BELOW, 1)}–{dec(EASY_AT, 1)} · <b>Berat</b> &lt; {dec(HARD_BELOW, 1)}. Kekuatan
        lawan dihitung dari gol musim ini di Serie A dan diperbarui otomatis setiap pekan. Hanya laga liga; laga Eropa dan piala tidak ikut dihitung. Perkiraan, bukan jaminan hasil.
      </p>
    </section>
  );
}
