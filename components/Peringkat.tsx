'use client';

import { useFetch } from '@/components/kp';
import type { ClubRank, PeringkatResponse } from '@/lib/peringkat';
import './peringkat.css';

const pts = (n: number) => n.toFixed(2).replace('.', ',');
const dash = '–';

function Crest({ club }: { club: Pick<ClubRank, 'name' | 'logo'> }) {
  // eslint-disable-next-line @next/next/no-img-element
  return club.logo ? <img className="kr-crest" src={club.logo} alt="" width={22} height={22} loading="lazy" referrerPolicy="no-referrer" /> : <i className="kr-crest ph">{club.name.charAt(0)}</i>;
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'dark' }) {
  return (
    <div className={`kr-tile${tone ? ` ${tone}` : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

function Row({ club, me }: { club: ClubRank; me?: boolean }) {
  return (
    <tr className={me ? 'me' : undefined}>
      <td className="n">{club.rank}</td>
      <td>
        <span className="who">
          <Crest club={club} />
          {club.name}
        </span>
      </td>
      <td className="p">{pts(club.points)}</td>
    </tr>
  );
}

/** Statistik → Analisa → Peringkat & keuangan → Peringkat klub (koefisien UEFA: 10 besar + Juventus). */
export default function Peringkat() {
  const res = useFetch<PeringkatResponse>('/api/analisa/peringkat');
  const d = res.data;
  if (res.loading) return <div className="kp-card kp-empty">Memuat peringkat klub…</div>;
  if (res.error || !d) return <div className="kp-card kp-empty">Peringkat klub belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div>;
  if (!d.top.length) return <div className="kp-card kp-empty">{d.warnings.join(' ') || 'Belum ada data peringkat.'}</div>;

  const { juve, italy, top } = d;
  const inTop = juve != null && juve.rank <= 10;
  const tenth = top[top.length - 1];
  const gapRef = inTop ? top[0] : tenth;
  const gap = juve && gapRef && juve.rank !== gapRef.rank ? gapRef.points - juve.points : null;

  return (
    <section className="kp-card kr">
      <header className="kp-card-head">
        <h2 className="kp-title">Peringkat &amp; keuangan klub</h2>
        <small className="kp-muted">Koefisien UEFA 5 musim terakhir</small>
      </header>

      <div className="kr-club">
        {juve ? <Crest club={juve} /> : null}
        <div>
          <b>Juventus FC</b>
          <small>Peringkat klub Eropa</small>
        </div>
      </div>

      <h3 className="kr-h">Peringkat klub</h3>
      <div className="kr-tiles">
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

      <div className="kr-tablewrap">
        <table className="kr-table">
          <thead>
            <tr>
              <th>#</th>
              <th>KLUB</th>
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

      <p className="kr-note">
        Koefisien UEFA = akumulasi poin 5 musim Eropa terakhir ({d.window}); menentukan unggulan undian.
        {d.source === 'uefa' ? ' Sumber: UEFA (data resmi).' : ' Sumber: Wikipedia (UEFA coefficient), hanya memuat 25 klub teratas.'}
        {d.warnings.map((w) => ` ${w}`).join('')}
      </p>
    </section>
  );
}
