'use client';

import type { ClubRank, PeringkatResponse } from '@/lib/analisa/peringkat';
import { DASH as dash, dec as pts } from '@/lib/analisa/util';
import { Card, Empty, Tile, useTab } from './ui';

function Crest({ club }: { club: Pick<ClubRank, 'name' | 'logo'> }) {
  // eslint-disable-next-line @next/next/no-img-element
  return club.logo ? <img className="an-crest" src={club.logo} alt="" width={22} height={22} loading="lazy" referrerPolicy="no-referrer" /> : <i className="an-crest ph">{club.name.charAt(0)}</i>;
}

function Row({ club, me }: { club: ClubRank; me?: boolean }) {
  return (
    <tr className={me ? 'me' : undefined}>
      <td className="c">{club.rank}</td>
      <td className="l">
        <span className="who">
          <Crest club={club} />
          {club.name}
        </span>
      </td>
      <td>{pts(club.points)}</td>
    </tr>
  );
}

/** Statistik → Analisa → Peringkat & keuangan → Peringkat klub (koefisien UEFA: 10 besar + Juventus). */
export default function Peringkat() {
  const { data: d, fallback } = useTab<PeringkatResponse>('/api/analisa/peringkat', 'Memuat peringkat klub…', 'Peringkat klub belum bisa dimuat. Coba muat ulang beberapa saat lagi.');
  if (!d) return fallback;
  if (!d.top.length) return <Empty>{d.warnings.join(' ') || 'Belum ada data peringkat.'}</Empty>;

  const { juve, italy, top } = d;
  const inTop = juve != null && juve.rank <= 10;
  const tenth = top[top.length - 1];
  const gapRef = inTop ? top[0] : tenth;
  const gap = juve && gapRef && juve.rank !== gapRef.rank ? gapRef.points - juve.points : null;

  return (
    <Card title="Peringkat & keuangan klub" sub="Koefisien UEFA 5 musim terakhir">
      <div className="an-club">
        {juve ? <Crest club={juve} /> : null}
        <div>
          <b>Juventus FC</b>
          <small>Peringkat klub Eropa</small>
        </div>
      </div>

      <h3 className="an-h">Peringkat klub</h3>
      <div className="an-tiles c3">
        <Tile
          tone="dark"
          label="Koefisien UEFA"
          value={juve ? `#${juve.rank}` : dash}
          sub={juve ? `${pts(juve.points)} poin${d.asOf ? ` · per ${d.asOf}` : ''}` : 'Juventus belum ada di data sumber'}
        />
        <Tile label="Klub Italia teratas UEFA" value={italy ? `${italy.name} (#${italy.rank})` : dash} sub={italy ? `${pts(italy.points)} poin` : undefined} />
        <Tile
          label={inTop ? 'Selisih dari puncak' : 'Selisih dari 10 besar'}
          value={gap == null ? dash : `${pts(gap)} poin`}
          sub={gap == null || !gapRef ? undefined : `dari ${gapRef.name} (#${gapRef.rank}, ${pts(gapRef.points)})`}
        />
      </div>

      <div className="an-tablewrap">
        <table className="an-table">
          <thead>
            <tr>
              <th className="rank">#</th>
              <th className="l">KLUB</th>
              <th>POIN KOEFISIEN</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c) => (
              <Row key={`${c.rank}-${c.name}`} club={c} me={juve != null && c.rank === juve.rank && c.name === juve.name} />
            ))}
            {juve && !inTop ? (
              <>
                <tr className="gap">
                  <td colSpan={3}>⋯</td>
                </tr>
                <Row club={juve} me />
              </>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="an-note">
        Koefisien UEFA = akumulasi poin 5 musim Eropa terakhir ({d.window}); menentukan unggulan undian.
        {d.source === 'uefa' ? ' Sumber: UEFA (data resmi).' : ' Sumber: Wikipedia (UEFA coefficient), hanya memuat 25 klub teratas.'}
        {d.warnings.map((w) => ` ${w}`).join('')}
      </p>
    </Card>
  );
}
