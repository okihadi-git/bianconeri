'use client';

import { useState } from 'react';
import { useFetch } from '@/components/kp';
import type { CoachResponse, SquadResponse } from '@/lib/types';
import type { CoachNation, CoachesResponse, ManagerRow } from '@/lib/coaches-types';
import './pelatih.css';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const initials = (name: string) => {
  const t = name.trim().split(/\s+/).filter(Boolean);
  return (t.length < 2 ? (t[0] ?? '?').slice(0, 2) : t[0][0] + t[t.length - 1][0]).toUpperCase();
};

function Avatar({ src, name, size = 40, ring = false }: { src: string | null; name: string; size?: number; ring?: boolean }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  const cls = `pc-av${ring ? ' pc-av-ring' : ''}`;
  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cls} style={style} src={src} alt="" loading="lazy" onError={() => setBroken(true)} />;
  }
  return (
    <span className={`${cls} pc-av-ini`} style={{ ...style, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function Flag({ n }: { n: CoachNation }) {
  const [broken, setBroken] = useState(false);
  if (!n.flag || broken) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="pc-flag" src={n.flag} alt="" width={20} height={14} loading="lazy" onError={() => setBroken(true)} />;
}

function Nations({ nations }: { nations: CoachNation[] }) {
  return (
    <>
      {nations.slice(0, 2).map((n, i) => (
        <span key={n.code} className="pc-nation">
          {i > 0 && <span className="pc-sep">/</span>}
          <Flag n={n} />
          {n.name}
        </span>
      ))}
    </>
  );
}

function Honours({ m }: { m: ManagerRow }) {
  if (!m.honours.length) return <span className="kp-muted">–</span>;
  return (
    <span className="pc-honours">
      {m.honours.map((h, i) => (
        <span key={h.label}>
          {i > 0 && ' · '}
          <b>{h.count > 1 ? `${h.count}× ` : ''}{h.label}</b>
        </span>
      ))}
    </span>
  );
}

const pct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;

export default function PelatihPage() {
  const squad = useFetch<SquadResponse>('/api/squad');
  const hist = useFetch<CoachesResponse>('/api/pelatih/riwayat?club=juventus');
  const d = hist.data;

  // Nama pelatih saat ini: dari data skuad (lebih cepat berubah), cadangan: baris "sekarang" di daftar Wikipedia
  const listed = d?.managers.find((m) => m.current) ?? null;
  const coachName = squad.data?.coach?.trim() || listed?.name || null;
  const bio = useFetch<CoachResponse>(coachName ? `/api/pelatih?name=${encodeURIComponent(coachName)}` : null);

  const row =
    coachName && d
      ? d.managers.find((m) => m.current && norm(m.name).split(' ').at(-1) === norm(coachName).split(' ').at(-1)) ?? null
      : listed;
  const mismatch = Boolean(d && coachName && listed && !row);
  const photo = bio.data?.photo ?? row?.photo ?? null;
  const nation = row?.nations[0] ?? null;
  const rows = d ? [...d.managers].reverse() : [];
  const trophies = row ? row.honours.reduce((n, h) => n + h.count, 0) : null;

  return (
    <div className="kp" id="pelatih">
      <section className="kp-card">
        <header className="kp-card-head">
          <h2 className="kp-title">Staf pelatih</h2>
          <small className="kp-muted">{d ? `Musim ${d.season}` : ''}</small>
        </header>

        {(squad.loading && !coachName) || (hist.loading && !coachName) ? (
          <div className="kp-empty">Memuat staf pelatih…</div>
        ) : !coachName ? (
          <div className="kp-empty">Nama pelatih belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div>
        ) : (
          <div className="pc-hero">
            <Avatar src={photo} name={coachName} size={84} ring />
            <div className="pc-hero-body">
              <div className="pc-role">Pelatih kepala</div>
              <h3 className="pc-name">{coachName}</h3>
              <div className="pc-sub kp-muted">
                {nation && <Nations nations={row!.nations} />}
                {row?.fromYear ? <> · menangani Juventus sejak {row.fromYear}</> : null}
              </div>
              {row && (
                <div className="pc-stats">
                  {row.matches != null && (
                    <div>
                      <b>{row.matches}</b>
                      <span>laga bersama Juventus</span>
                    </div>
                  )}
                  {row.winPct != null && (
                    <div>
                      <b>{pct(row.winPct)}</b>
                      <span>persentase menang</span>
                    </div>
                  )}
                  {trophies != null && (
                    <div>
                      <b>{trophies}</b>
                      <span>trofi bersama Juventus</span>
                    </div>
                  )}
                </div>
              )}
              {bio.data?.url && (
                <a className="pc-wiki" href={bio.data.url} target="_blank" rel="noopener noreferrer">
                  Profil di Wikipedia →
                </a>
              )}
            </div>
          </div>
        )}

        {d && d.staff.length > 0 && (
          <div className="pc-staff">
            {d.staff.map((s) => (
              <div key={s.name} className="pc-staff-item">
                <Avatar src={s.photo} name={s.name} size={44} />
                <div>
                  <div className="pc-staff-name">{s.name}</div>
                  <div className="pc-staff-role kp-muted">
                    {s.role} · <Flag n={s.nation} />
                    <span className="pc-code">{s.nation.code}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <footer className="kp-legend">
          <span className="kp-legend-note">
            Daftar staf ditulis manual dari pengumuman klub dan pemberitaan media per {d?.staffAsOf ?? '–'}; perubahan sesudahnya tidak otomatis. Pelatih kiper,
            tim medis, dan analis tidak ditampilkan karena tidak ada sumber gratis yang andal. Foto dari Wikipedia/Wikimedia Commons, hak cipta foto milik
            pemiliknya; tanpa foto ditampilkan inisial.
            {mismatch && ' Artikel Wikipedia belum memuat pelatih saat ini, jadi statistik laganya belum tersedia.'}
          </span>
        </footer>
      </section>

      <section className="kp-card pc-hist">
        <header className="kp-card-head">
          <h2 className="kp-title">Pelatih kepala sebelumnya</h2>
          <small className="kp-muted">{d?.managers[0]?.fromYear ? `Pelatih tetap sejak ${d.managers[0].fromYear}` : ''}</small>
        </header>

        {hist.loading && <div className="kp-empty">Memuat riwayat pelatih…</div>}
        {hist.error && <div className="kp-empty">Riwayat pelatih belum bisa dimuat. Coba muat ulang halaman sebentar lagi.</div>}
        {d && !d.managers.length && <div className="kp-empty">Daftar pelatih dari Wikipedia belum bisa dibaca saat ini.</div>}

        {d && d.managers.length > 0 && (
          <div className="pc-table-wrap">
            <table className="pc-table">
              <thead>
                <tr>
                  <th className="pc-c-n">#</th>
                  <th>Nama</th>
                  <th>Negara</th>
                  <th className="pc-c-per">Periode</th>
                  <th>Trofi utama</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.n} className={m.current ? 'pc-row-current' : undefined}>
                    <td className="pc-c-n kp-muted">{m.n}</td>
                    <td>
                      <div className="pc-person">
                        <Avatar src={m.photo} name={m.name} size={38} />
                        <b>{m.name}</b>
                      </div>
                    </td>
                    <td>
                      <Nations nations={m.nations} />
                    </td>
                    <td className="pc-c-per">{m.period}</td>
                    <td>
                      <Honours m={m} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {d && d.managers.length > 0 && (
          <p className="kp-note pc-foot">
            Hanya pelatih kepala tetap.
            {d.interim.length > 0 && (
              <> Pelatih sementara (caretaker) tidak dihitung, misalnya {d.interim.slice(-5).map((i) => `${i.name} (${i.year})`).join(', ')}.</>
            )}{' '}
            Trofi utama dihitung per jumlah gelar (tanpa tahun): Scudetto, Coppa Italia, Supercoppa, dan trofi Eropa. Sumber:{' '}
            {d.source ? (
              <a href={d.source.url} target="_blank" rel="noopener noreferrer">
                Wikipedia, “{d.source.title}”
              </a>
            ) : (
              'Wikipedia'
            )}
            , lisensi{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.id" target="_blank" rel="noopener noreferrer">
              CC BY-SA 4.0
            </a>
            {d.statsAsOf ? `; statistik laga per ${d.statsAsOf}` : ''}. Foto dimuat dari artikel Wikipedia masing-masing; hak cipta foto milik pemiliknya.
          </p>
        )}
      </section>
    </div>
  );
}
