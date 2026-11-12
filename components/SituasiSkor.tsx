'use client';

import { useState } from 'react';
import { useFetch } from '@/components/kp';
import type { MatchRow, SituasiSkorResponse } from '@/lib/situasiskor';
import './situasiskor.css';

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
const mskk = (r: { w: number; d: number; l: number }) => `${r.w}M ${r.d}S ${r.l}K`;
const dateWib = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'numeric' }).formatToParts(d);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? 0);
  const mon = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  return `${day} ${m[mon - 1]}`;
};

function Flow({ m }: { m: MatchRow }) {
  const at = (t: number) => `${Math.min(100, Math.max(0, (t / m.duration) * 100))}%`;
  return (
    <div className="ss-flow" aria-hidden="true">
      {m.segments.map((s, i) => (
        <i key={i} className={s.state} style={{ left: at(s.from), width: `${((s.to - s.from) / m.duration) * 100}%` }} />
      ))}
      {m.goals.map((g, i) => (
        <b key={i} className={`ss-ball ${g.side}`} style={{ left: at(g.t) }} title={`${g.label} ${g.side === 'juve' ? 'Juventus' : m.opp}${g.who ? ` · ${g.who}` : ''}`} />
      ))}
    </div>
  );
}

/** Statistik → Analitik → 03 Situasi skor (unggul/imbang/tertinggal, gol per 15 menit, alur skor tiap laga). */
export default function SituasiSkor() {
  const [comp, setComp] = useState('all');
  const res = useFetch<SituasiSkorResponse>(`/api/analitik/situasi-skor?comp=${encodeURIComponent(comp)}`);
  const d = res.data;

  const t = d?.minutes.total ?? 0;
  const lead = pct(d?.minutes.lead ?? 0, t);
  const trail = pct(d?.minutes.trail ?? 0, t);
  const level = Math.max(0, 100 - lead - trail);
  const maxBin = Math.max(1, ...(d?.bins ?? []).flatMap((b) => [b.scored, b.conceded]));

  return (
    <section className="ss">
      <header className="ss-head">
        <span className="ss-num">03</span>
        <h2>SITUASI SKOR</h2>
        <small>Unggul, imbang, tertinggal, dan kapan gol terjadi</small>
      </header>

      {d && d.competitions.length > 1 ? (
        <div className="ss-pills" role="tablist" aria-label="Kompetisi">
          {[{ id: 'all', name: 'Semua' }, ...d.competitions].map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={comp === c.id} className={`ss-pill${comp === c.id ? ' on' : ''}`} onClick={() => setComp(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      {res.loading ? <div className="ss-empty">Memuat situasi skor… (pertama kali bisa beberapa detik)</div> : null}
      {!res.loading && (res.error || !d) ? <div className="ss-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && !res.loading ? (
        d.matches.length === 0 ? (
          <div className="ss-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
        ) : (
          <>
            <div className="ss-cards">
              <div className="ss-card hero">
                <small>WAKTU UNGGUL</small>
                <b>{lead}%</b>
                <span>{Math.round(d.minutes.lead)} menit</span>
              </div>
              <div className="ss-card">
                <small>POIN HILANG DARI POSISI UNGGUL</small>
                <b>{d.lostFromLead.points}</b>
                <span>{d.lostFromLead.matches} laga</span>
              </div>
              <div className="ss-card">
                <small>POIN DARI POSISI TERTINGGAL</small>
                <b>{d.fromTrailing.points}</b>
                <span>{d.fromTrailing.matches} laga comeback</span>
              </div>
              <div className="ss-card">
                <small>CETAK GOL DULUAN</small>
                <b>{mskk(d.scoredFirst).replace(/ /g, '')}</b>
                <span>kebobolan duluan: {mskk(d.concededFirst).replace(/ /g, '')}</span>
              </div>
            </div>

            <div className="ss-stack" role="img" aria-label={`Unggul ${lead}%, imbang ${level}%, tertinggal ${trail}%`}>
              <i className="lead" style={{ width: `${lead}%` }} />
              <i className="level" style={{ width: `${level}%` }} />
              <i className="trail" style={{ width: `${trail}%` }} />
            </div>
            <ul className="ss-key">
              <li><i className="lead" />unggul {lead}%</li>
              <li><i className="level" />imbang {level}%</li>
              <li><i className="trail" />tertinggal {trail}%</li>
            </ul>

            <div className="ss-cols">
              <div>
                <h3>Gol per 15 menit</h3>
                <ul className="ss-bins">
                  {d.bins.map((b) => (
                    <li key={b.label}>
                      <span className="n">{b.scored || ''}</span>
                      <div className="l">
                        <i style={{ width: `${(b.scored / maxBin) * 100}%` }} />
                      </div>
                      <code>{b.label}</code>
                      <div className="r">
                        <i style={{ width: `${(b.conceded / maxBin) * 100}%` }} />
                      </div>
                      <span className="n c">{b.conceded || ''}</span>
                    </li>
                  ))}
                </ul>
                <ul className="ss-key">
                  <li><i className="lead" />dicetak</li>
                  <li><i className="trail" />kebobolan</li>
                </ul>
              </div>

              <div>
                <h3>Alur skor tiap laga</h3>
                <ul className="ss-matches">
                  {d.matches.map((m) => (
                    <li key={m.id} className="ss-m">
                      <span className="ss-mn" title={`${dateWib(m.iso)} · ${m.opp}`}>
                        {dateWib(m.iso)} · {m.opp}
                      </span>
                      <Flow m={m} />
                      <span className={`ss-score ${m.result}`}>
                        {m.juve}-{m.against}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="ss-note">
              Sumber: FotMob (menit dan sisi tiap gol), {d.matches.length} laga. Skor Juventus ditulis lebih dulu; garis waktu mengikuti menit nyata termasuk tambahan waktu bila dilaporkan. Gol pada tambahan waktu dan perpanjangan masuk ke kelompok 76-90+. Adu penalti tidak dihitung.
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
