'use client';

import { useMemo } from 'react';
import { useFetch } from '@/components/kp';
import type { CoachResponse, SquadResponse } from '@/lib/types';

export default function PelatihPage() {
  const squad = useFetch<SquadResponse>('/api/squad');
  const coachName = squad.data?.coach?.trim() || null;
  const bio = useFetch<CoachResponse>(coachName ? `/api/pelatih?name=${encodeURIComponent(coachName)}` : null);

  const stats = useMemo(() => {
    const players = squad.data?.players ?? [];
    const ages = players.filter((p) => p.age != null);
    return {
      count: players.length,
      avgAge: ages.length ? ages.reduce((n, p) => n + (p.age ?? 0), 0) / ages.length : null,
      nations: new Set(players.map((p) => p.nation[0]).filter(Boolean)).size,
    };
  }, [squad.data]);

  const src = squad.data?.source === 'fotmob' ? 'FotMob' : 'Transfermarkt';
  const d = bio.data;

  return (
    <div className="kp" id="pelatih">
      <div className="kp-metrics">
        <div className="kp-metric kp-metric-red">
          <div className="kp-metric-label">Pelatih kepala</div>
          <div className="kp-metric-val sq-coach">{coachName ?? '–'}</div>
          <div className="kp-metric-sub">{squad.data ? `Data: ${src}` : squad.loading ? 'Memuat data…' : ' '}</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Pemain yang dilatih</div>
          <div className="kp-metric-val">{stats.count || '–'}</div>
          <div className="kp-metric-sub">Tim utama</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Rata-rata usia skuad</div>
          <div className="kp-metric-val">{stats.avgAge != null ? stats.avgAge.toFixed(1).replace('.', ',') : '–'}</div>
          <div className="kp-metric-sub">Tahun</div>
        </div>
        <div className="kp-metric">
          <div className="kp-metric-label">Negara asal pemain</div>
          <div className="kp-metric-val">{stats.nations || '–'}</div>
          <div className="kp-metric-sub">Berdasarkan kebangsaan utama</div>
        </div>
      </div>

      <section className="kp-card">
        <header className="kp-card-head">
          <h2 className="kp-title">Profil pelatih</h2>
          {d && <small className="kp-muted">Wikipedia bahasa {d.lang === 'id' ? 'Indonesia' : 'Inggris'}</small>}
        </header>

        {squad.loading || (coachName && bio.loading) ? (
          <div className="kp-empty">Memuat profil pelatih…</div>
        ) : squad.error || !coachName ? (
          <div className="kp-empty">
            Nama pelatih belum bisa dimuat dari Transfermarkt maupun FotMob. Coba muat ulang beberapa saat lagi.
          </div>
        ) : !d ? (
          <div className="kp-empty">
            Profil <b>{coachName}</b> belum ditemukan di Wikipedia, jadi hanya namanya yang ditampilkan.
          </div>
        ) : (
          <div className={`pl-body${d.photo ? ' has-photo' : ''}`}>
            {d.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="pl-photo" src={d.photo} alt={`Foto ${d.title}`} loading="lazy" />
            )}
            <div className="pl-text">
              <h3 className="pl-name">{coachName}</h3>
              {d.description && <div className="pl-desc kp-muted">{d.description}</div>}
              {d.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <a className="pl-link" href={d.url} target="_blank" rel="noopener noreferrer">
                Baca selengkapnya di Wikipedia →
              </a>
            </div>
          </div>
        )}

        <footer className="kp-legend">
          <span className="kp-legend-note">
            Nama pelatih dari {squad.data ? src : 'Transfermarkt/FotMob'} (tidak resmi). Ringkasan profil dari Wikipedia, lisensi{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.id" target="_blank" rel="noopener noreferrer" className="pl-link-inline">
              CC BY-SA 4.0
            </a>
            , dipangkas per paragraf. Statistik karier, formasi, dan rekor kemenangan tidak tersedia dari sumber yang dipakai, jadi tidak ditampilkan.
          </span>
        </footer>
      </section>
    </div>
  );
}
