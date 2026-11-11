'use client';

import { useEffect, useState } from 'react';
import type { Match } from '@/lib/types';
import type { RatedPlayer, RatedTeam, RatingResponse } from '@/lib/ratings';
import './rating-modal.css';

const fmt = (n: number | null) => (n === null ? '–' : n.toFixed(1).replace('.', ','));
const tone = (n: number | null) => (n === null ? 'na' : n >= 7 ? 'hi' : n >= 6 ? 'mid' : 'lo');

const PARTICLES = new Set(['di', 'de', 'da', 'del', 'della', 'van', 'von', 'dos', 'le', 'la', 'el', 'al', 'ter', 'den']);
/** "Michele Di Gregorio" → "M. Di Gregorio" */
function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  let i = parts.length - 1;
  while (i > 0 && PARTICLES.has(parts[i - 1].toLowerCase())) i--;
  return `${parts[0][0]}. ${parts.slice(i).join(' ')}`;
}
const initials = (n: string) => {
  const t = n.trim().split(/\s+/).filter(Boolean);
  return (t.length < 2 ? (t[0] ?? '?').slice(0, 2) : t[0][0] + t[t.length - 1][0]).toUpperCase();
};

function Avatar({ src, name, size = 48 }: { src: string; name: string; size?: number }) {
  const [bad, setBad] = useState(false);
  return src && !bad ? (
    <img src={src} alt="" className="rt-ava" style={{ width: size, height: size }} onError={() => setBad(true)} />
  ) : (
    <span className="rt-ava rt-ava-ph" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

function Token({ p }: { p: RatedPlayer }) {
  return (
    <div className={`rt-tok${p.best ? ' best' : ''}`}>
      <div className="rt-tok-pic">
        <Avatar src={p.photo} name={p.name} />
        {p.subOff && <i className="rt-b rt-b-off" title={`Diganti menit ${p.subOff}`}>↓</i>}
        {p.red > 0 ? <i className="rt-b rt-b-card red" title="Kartu merah" /> : p.yellow > 0 ? <i className="rt-b rt-b-card" title="Kartu kuning" /> : null}
        {p.goals > 0 && <i className="rt-b rt-b-goal" title={`${p.goals} gol`}>{p.goals > 1 ? p.goals : '⚽'}</i>}
        {p.assists > 0 && <i className="rt-b rt-b-ast" title={`${p.assists} assist`}>A</i>}
      </div>
      <span className={`rt-pill ${tone(p.rating)}`}>
        {fmt(p.rating)}
        {p.best && <b> ★</b>}
      </span>
      <span className="rt-tok-name">
        <em>{p.jersey}</em> {shortName(p.name)}
      </span>
    </div>
  );
}

function TeamHead({ t }: { t: RatedTeam }) {
  return (
    <div className="rt-thead">
      {t.logo && <img src={t.logo} alt="" className="rt-crest" />}
      <strong>{t.name}</strong>
      <span className="rt-chip">Ø {fmt(t.avg)}</span>
      <span className="rt-chip rt-chip-r">{t.formation || '–'}</span>
    </div>
  );
}

function Coach({ t }: { t: RatedTeam }) {
  if (!t.coach) return null;
  return (
    <div className="rt-coach">
      <Avatar src={t.coach.photo} name={t.coach.name} size={30} />
      <div>
        <small>PELATIH</small>
        <b>{t.coach.name}</b>
      </div>
    </div>
  );
}

function Rows({ t, flip }: { t: RatedTeam; flip?: boolean }) {
  const rows = flip ? [...t.rows].reverse() : t.rows;
  return (
    <>
      {rows.map((row, i) => (
        <div className="rt-row" key={i}>
          {row.map((p) => (
            <Token key={p.id} p={p} />
          ))}
        </div>
      ))}
    </>
  );
}

function Subs({ t }: { t: RatedTeam }) {
  return (
    <div className="rt-subs-col">
      <h4>{t.name} · CADANGAN</h4>
      {t.subs.map((p) => (
        <div className={`rt-sub${p.rating === null ? ' off' : ''}`} key={p.id}>
          <Avatar src={p.photo} name={p.name} size={34} />
          <span className="rt-sub-name">
            <em>{p.jersey}</em> {p.name}
            {p.subOn && <small> ↑ {p.subOn}</small>}
            {p.yellow > 0 && p.red === 0 && <i className="rt-b-card inl" />}
            {p.red > 0 && <i className="rt-b-card inl red" />}
            {p.goals > 0 && <span> ⚽</span>}
          </span>
          <span className={`rt-pill ${tone(p.rating)}`}>{fmt(p.rating)}</span>
        </div>
      ))}
    </div>
  );
}

export default function RatingModal({ match, onClose }: { match: Match; onClose: () => void }) {
  const [data, setData] = useState<RatingResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/match/${match.id}/rating?league=${encodeURIComponent(match.league)}`);
        const json = await res.json();
        if (!res.ok || json?.error) throw new Error(json?.error || 'gagal');
        if (!cancelled) setData(json as RatingResponse);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.message !== 'gagal' ? e.message : 'Rating belum bisa dimuat dari ESPN.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [match.id, match.league]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const juveFirst = data ? (data.home.isJuve ? [data.home, data.away] : [data.away, data.home]) : null;
  const title = data
    ? `${data.home.name} ${data.score.home}–${data.score.away} ${data.away.name}`
    : match.isHome
      ? `Juventus ${match.juveScore}–${match.opponentScore} ${match.opponent}`
      : `${match.opponent} ${match.opponentScore}–${match.juveScore} Juventus`;

  return (
    <div className="rt-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Rating pemain">
      <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
        <header className="rt-head">
          <div>
            <small>RATING PEMAIN</small>
            <h3>{title}</h3>
            <span>
              {match.dateLabel} · {match.competition}
            </span>
          </div>
          <button className="rt-x" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>

        <div className="rt-body">
          {!data && !error && <div className="rt-state">Memuat rating…</div>}
          {error && <div className="rt-state">{error}</div>}

          {data && juveFirst && (
            <>
              {data.best && (
                <div className="rt-best">
                  <Avatar src={data.best.player.photo} name={data.best.player.name} size={44} />
                  <div>
                    <small>PEMAIN TERBAIK (RATING TERTINGGI)</small>
                    <b>{data.best.player.name}</b>
                  </div>
                  <span className="rt-pill hi big">{fmt(data.best.player.rating)}</span>
                </div>
              )}

              <div className="rt-pitch">
                <TeamHead t={juveFirst[0]} />
                <Coach t={juveFirst[0]} />
                <Rows t={juveFirst[0]} />
                <div className="rt-mid" aria-hidden />
                <Rows t={juveFirst[1]} flip />
                <Coach t={juveFirst[1]} />
                <TeamHead t={juveFirst[1]} />
              </div>

              <div className="rt-subs">
                <Subs t={juveFirst[0]} />
                <Subs t={juveFirst[1]} />
              </div>

              <p className="rt-note">
                ⚽ gol · <b className="rt-note-a">A</b> assist · <i className="rt-b-card inl" />/<i className="rt-b-card inl red" /> kartu · ↓ diganti ·{' '}
                ↑ masuk.{' '}
                {data.source === 'fotmob' ? (
                  <>
                    <b>Rating dari FotMob</b>, foto pemain juga dari FotMob. Data tidak resmi dan bisa berbeda dari yang tampil di aplikasi FotMob.
                  </>
                ) : (
                  <>
                    <b>Rating Bianconeri</b> adalah estimasi otomatis dari statistik pemain ESPN (gol, assist, tembakan, penyelamatan, kartu, pelanggaran,
                    hasil laga) dengan skala 6,0 sebagai rata-rata, bukan rating resmi FotMob/SofaScore.
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
