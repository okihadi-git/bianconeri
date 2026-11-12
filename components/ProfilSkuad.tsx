'use client';

import { useFetch } from '@/components/kp';
import { countryId, flagUrl } from '@/lib/countries';
import type { SkuadResponse } from '@/lib/skuad';
import './skuad.css';

const nf = (n: number) => n.toLocaleString('id-ID');
const dec = (n: number) => n.toFixed(1).replace('.', ',');
const AGE_COLORS = ['#ffc72c', '#4f7cff', '#3ecf7c', '#ff6b81'];

interface Seg {
  label: string;
  pct: number;
  color: string;
}

function Donut({ segs, center, sub }: { segs: Seg[]; center: string; sub: string }) {
  const r = 52;
  const C = 2 * Math.PI * r;
  const total = segs.reduce((n, s) => n + s.pct, 0) || 1;
  let acc = 0;
  return (
    <div className="sk-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={segs.map((s) => `${s.label} ${s.pct}%`).join(', ')}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#242424" strokeWidth="18" />
        {segs.map((s) => {
          const len = (s.pct / total) * C;
          const el = <circle key={s.label} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" />;
          acc += len;
          return el;
        })}
        <text x="70" y="70" textAnchor="middle" className="sk-dc">{center}</text>
        <text x="70" y="88" textAnchor="middle" className="sk-ds">{sub}</text>
      </svg>
      <ul className="sk-legend">
        {segs.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <b>{s.pct}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Statistik → Analitik → 11 Profil skuad (usia, akademi, negara; dibobot menit bermain). */
export default function ProfilSkuad() {
  const res = useFetch<SkuadResponse>('/api/analitik/profil-skuad');
  const d = res.data;
  const aca = d?.academy.pct ?? null;
  const top = d?.countries.list.slice(0, 8) ?? [];
  const maxPct = Math.max(1, ...top.map((c) => c.pct));

  return (
    <section className="sk">
      <header className="sk-head">
        <span className="sk-numtag">11</span>
        <h2>PROFIL SKUAD</h2>
        <small>Usia, akademi, negara</small>
      </header>

      {res.loading ? <div className="sk-empty">Memuat profil skuad… (pertama kali bisa beberapa detik)</div> : null}
      {!res.loading && (res.error || !d) ? <div className="sk-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && !res.loading ? (
        d.players === 0 ? (
          <div className="sk-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
        ) : (
          <>
            <div className="sk-cards">
              <div className="sk-card hero">
                <small>USIA RATA-RATA (BOBOT MENIT)</small>
                <b>{d.avgAge != null ? dec(d.avgAge) : '–'}</b>
                <span>tahun</span>
              </div>
              <div className="sk-card">
                <small>MENIT LULUSAN AKADEMI</small>
                <b>{aca != null ? `${aca}%` : '–'}</b>
                <span>{aca != null ? `${nf(d.academy.minutes)} menit` : 'riwayat karier tidak tersedia'}</span>
              </div>
              <div className="sk-card">
                <small>NEGARA DI LAPANGAN</small>
                <b>{d.countries.count || '–'}</b>
                <span>kewarganegaraan</span>
              </div>
              <div className="sk-card">
                <small>TOTAL MENIT TERCATAT</small>
                <b>{nf(d.totalMinutes)}</b>
                <span>{d.players} pemain</span>
              </div>
            </div>

            <div className="sk-cols">
              <div>
                <h3>Menit per kelompok usia</h3>
                {d.ageBands.length ? <Donut segs={d.ageBands.map((b, i) => ({ label: b.label, pct: b.pct, color: AGE_COLORS[i] }))} center={d.avgAge != null ? dec(d.avgAge) : '–'} sub="usia rata-rata" /> : <div className="sk-empty small">Tanggal lahir tidak tersedia.</div>}
              </div>
              <div>
                <h3>Akademi vs rekrutan</h3>
                {aca != null ? <Donut segs={[{ label: 'Lulusan akademi', pct: aca, color: '#ffc72c' }, { label: 'Rekrutan', pct: 100 - aca, color: '#9aa0b4' }]} center={`${aca}%`} sub="dari akademi" /> : <div className="sk-empty small">Riwayat karier FotMob tidak tersedia.</div>}
              </div>
              <div>
                <h3>Menit per negara</h3>
                {top.length ? (
                  <ul className="sk-countries">
                    {top.map((c) => (
                      <li key={c.country}>
                        <span className="sk-cn">
                          {flagUrl(c.country) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={flagUrl(c.country)} alt="" width={20} height={14} /> : <i className="sk-noflag" />}
                          {countryId(c.country)}
                        </span>
                        <div className="sk-cbar"><i style={{ width: `${(c.pct / maxPct) * 100}%` }} /></div>
                        <b>{c.pct}%</b>
                      </li>
                    ))}
                    {d.countries.list.length > top.length ? <li className="sk-more">+ {d.countries.list.length - top.length} negara lain</li> : null}
                  </ul>
                ) : (
                  <div className="sk-empty small">Negara pemain tidak tersedia.</div>
                )}
              </div>
            </div>

            <p className="sk-note">
              Semua angka dibobot menit bermain di laga resmi (liga, Eropa, piala) dan dihitung dari data pergantian FotMob. Usia dihitung per hari ini. &quot;Lulusan akademi&quot; = pernah tercatat di tim usia atau Next Gen Juventus pada riwayat karier FotMob, termasuk pemain yang bergabung saat remaja; bila FotMob tidak mencatat jenjang usia seorang pemain, ia dihitung rekrutan{d.academy.known < d.players ? ` (status akademi diketahui untuk ${d.academy.known} dari ${d.players} pemain)` : ''}.
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
