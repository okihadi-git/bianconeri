'use client';

import { useMemo, useState } from 'react';
import type { JFixture, JTeam } from '@/lib/analisa/jadwal';
import { EASY_AT, HARD_BELOW, LEVEL_LABEL, defaultRival } from '@/lib/analisa/jadwal-ui';
import type { JadwalResponse } from '@/lib/analisa/jadwal-server';
import { dec } from '@/lib/analisa/util';
import { shortDate } from '@/lib/wib';
import { Card, Empty, Logo, useTab } from './ui';

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
    <div>
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
  const { data: d, fallback } = useTab<JadwalResponse>('/api/analisa/jadwal', 'Memuat kesulitan jadwal…', 'Klasemen dan jadwal Serie A belum bisa dimuat dari ESPN. Coba muat ulang beberapa saat lagi.');
  const [rivalId, setRivalId] = useState('');

  const juve = d?.teams.find((t) => t.id === d.juveId) ?? null;
  const rival = useMemo(() => {
    if (!d) return null;
    const id = rivalId && rivalId !== d.juveId ? rivalId : defaultRival(d.teams, d.juveId);
    return d.teams.find((t) => t.id === id) ?? null;
  }, [d, rivalId]);

  if (!d) return fallback;
  if (!juve) return <Empty>{d.warnings[0] ?? 'Juventus tidak ditemukan di klasemen Serie A.'}</Empty>;

  return (
    <Card title="Kesulitan jadwal" sub={`${d.horizon} laga liga ke depan, Juventus vs rival`}>
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
      {d.warnings.length > 0 && <p className="an-warn">{d.warnings.join(' ')}</p>}

      <p className="an-note">
        <b>xPts</b> = perkiraan poin dari model Poisson (3 × peluang menang + peluang seri), memperhitungkan kandang/tandang. <b>Mudah</b> ≥ {dec(EASY_AT, 1)} · <b>Sedang</b> {dec(HARD_BELOW, 1)}–{dec(EASY_AT, 1)} · <b>Berat</b> &lt; {dec(HARD_BELOW, 1)}. Kekuatan
        lawan dihitung dari gol musim ini di Serie A dan diperbarui otomatis setiap pekan. Hanya laga liga; laga Eropa dan piala tidak ikut dihitung. Perkiraan, bukan jaminan hasil.
      </p>
    </Card>
  );
}
