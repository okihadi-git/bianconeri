'use client';

import type { CompareTeam, LawanResponse } from '@/lib/analisa/lawan-server';
import { DASH, dec } from '@/lib/analisa/util';
import { Card, Empty, Logo, Tile, useTab } from './ui';

const per = (n: number, played: number) => (played ? dec(n / played) : DASH);

/** "Min 22 Nov, 00:30 WIB" */
function kickoff(iso: string): string {
  const parts = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('weekday')} ${g('day')} ${g('month')}, ${g('hour')}:${g('minute')} WIB`;
}
const shortDate = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso));

const rec = (r: CompareTeam['home']) => `${r.w}-${r.d}-${r.l} · ${r.gf}–${r.ga}`;

export default function LawanBerikutnya() {
  const { data: d, fallback } = useTab<LawanResponse>('/api/analisa/lawan', 'Memuat analisa lawan berikutnya…', 'Jadwal Juventus belum bisa dimuat dari ESPN. Coba muat ulang beberapa saat lagi.');
  if (!d) return fallback;
  if (!d.match) return <Empty>Belum ada laga Juventus berikutnya di jadwal ESPN.</Empty>;

  const { match: m, prediction: p, compare: c, weather: w } = d;
  const rows: [string, string, string][] = c
    ? [
        ['Posisi', `#${c.juve.position}`, `#${c.opp.position}`],
        ['Poin', `${c.juve.points} dari ${c.juve.played} laga`, `${c.opp.points} dari ${c.opp.played} laga`],
        ['Menang-seri-kalah', `${c.juve.rec.w}-${c.juve.rec.d}-${c.juve.rec.l}`, `${c.opp.rec.w}-${c.opp.rec.d}-${c.opp.rec.l}`],
        ['Gol per laga', per(c.juve.rec.gf, c.juve.rec.played), per(c.opp.rec.gf, c.opp.rec.played)],
        ['Kebobolan per laga', per(c.juve.rec.ga, c.juve.rec.played), per(c.opp.rec.ga, c.opp.rec.played)],
        ['Kandang', rec(c.juve.home), rec(c.opp.home)],
        ['Tandang', rec(c.juve.away), rec(c.opp.away)],
      ]
    : [];

  return (
    <Card title="Analisa lawan berikutnya" sub="Prediksi skor, perbandingan musim ini, hasil terakhir lawan, cuaca">
      <div className="an-head">
        <div className="an-logos"><Logo src={m.juve.logo} size={40} /><Logo src={m.opp.logo} size={40} /></div>
        <div>
          <h3>Juventus vs {m.opp.name}</h3>
          <small>{[m.competition, m.isHome ? 'kandang' : 'tandang', m.venue, kickoff(m.iso)].filter(Boolean).join(' · ')}</small>
        </div>
      </div>

      {p ? (
        <>
          <h4 className="an-h">Prediksi model Bianconeri</h4>
          <div className="an-tiles">
            <Tile label="Juventus menang" value={`${p.win}%`} />
            <Tile label="Seri" value={`${p.draw}%`} />
            <Tile label={`${m.opp.name} menang`} value={`${p.loss}%`} />
            <Tile label="Skor paling mungkin" value={p.top[0].score.replace('–', '-')} sub={p.top.slice(1).map((t) => `${t.score} (${t.p}%)`).join(' · ')} />
          </div>
          <p className="an-note">
            Perkiraan gol: Juventus {dec(p.lambdaJuve)} · {m.opp.name} {dec(p.lambdaOpp)}. Model Poisson dari {d.basis} (sama dengan Peluang juara) plus keuntungan kandang; cedera dan rotasi tidak dihitung.
          </p>
        </>
      ) : (
        <p className="an-note">Prediksi belum bisa dihitung karena klasemen Serie A belum termuat.</p>
      )}

      {c && (
        <>
          <h4 className="an-h">Perbandingan musim ini ({c.league})</h4>
          <div className="an-tablewrap">
            <table className="an-table">
              <thead>
                <tr><th /><th>JUVENTUS</th><th>{m.opp.name.toUpperCase()}</th></tr>
              </thead>
              <tbody>
                {rows.map(([k, a, b]) => (
                  <tr key={k}><td>{k}</td><td><b>{a}</b></td><td><b>{b}</b></td></tr>
                ))}
                <tr>
                  <td>5 laga terakhir</td>
                  {[c.juve.form, c.opp.form].map((f, i) => (
                    <td key={i}>
                      <span className="an-form">
                        {f.length ? f.map((x, j) => <i key={j} className={`an-f-${x}`}>{x}</i>) : DASH}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
      {!c && p && <p className="an-note">Perbandingan klasemen hanya tersedia untuk lawan dari Serie A.</p>}

      {d.oppRecent.length > 0 && (
        <>
          <h4 className="an-h">Hasil terakhir {m.opp.name}</h4>
          <ul className="an-recent">
            {d.oppRecent.map((r) => (
              <li key={r.iso}>
                <b>{r.home ? 'vs' : 'di'} {r.opp}</b>
                <span>{shortDate(r.iso)} · <b>{r.score}</b></span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4 className="an-h">Cuaca saat kick-off</h4>
      {w ? (
        <>
          <div className="an-wx">
            <span className="an-wx-icon" aria-hidden>{w.icon}</span>
            <div>
              <b>{w.temp}°C · {w.label}</b>
              <small>{[w.city, w.country, m.venue, kickoff(m.iso)].filter(Boolean).join(' · ')}</small>
            </div>
          </div>
          <div className="an-wx-stats">
            <div><b>{w.feels}°</b><span>terasa</span></div>
            <div><b>{w.rain}%</b><span>peluang hujan</span></div>
            <div><b>{w.wind}</b><span>angin km/j</span></div>
          </div>
          <p className="an-note">
            {w.note} · <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
          </p>
        </>
      ) : (
        <p className="an-note">{d.weatherNote || 'Cuaca belum tersedia.'}</p>
      )}

      {d.warnings.map((x) => (
        <p key={x} className="an-warn">{x}</p>
      ))}
    </Card>
  );
}
