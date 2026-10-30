'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { JUVE_LOGO, RESULT_WORD, calendarUrl, fmtClock, fmtSigned, fmtWhen, shortRound } from '@/components/kp';
import { STAGE_LABEL, coppaStatus } from '@/lib/coppa';
import type { Letter, Match, Team } from '@/lib/types';

const COMP_PILL: Record<string, { label: string; cls: string }> = {
  'ita.1': { label: 'LIGA', cls: 'liga' },
  'uefa.europa': { label: 'UEL', cls: 'uel' },
  'uefa.champions': { label: 'UCL', cls: 'ucl' },
  'ita.coppa_italia': { label: 'COPPA', cls: 'coppa' },
  'ita.super_cup': { label: 'SUPER', cls: 'super' },
};

const EUROPA_LEAGUE_GAMES = 8;

/** "Pekan 10" untuk Serie A, selain itu babak dari ESPN ("Matchday 4", "Round of 16", …). */
function roundLabel(m: Match) {
  if (m.league === 'ita.1' && m.week) return `Pekan ${m.week}`;
  return m.round ? shortRound(m.round) : '';
}

const scoreLine = (m: Match) => {
  const word = RESULT_WORD[m.result as Letter] ?? '';
  return `${word} ${m.juveScore}–${m.opponentScore} ${m.isHome ? 'vs' : 'di'} ${m.opponent}`;
};

/* ---------- ringkasan peringkat 3 kompetisi ---------- */

function coppaSummary(past: Match[], upcoming: Match[]) {
  const { stage, eliminated, champion, last, lastStage, next, aggregate } = coppaStatus(past, upcoming);
  if (!last && !next) {
    return { big: 'Belum main', tag: '', text: 'Belum ada laga Coppa Italia musim ini.' };
  }
  const label = stage ? STAGE_LABEL[stage] : 'Babak gugur';
  const lastLabel = lastStage ? STAGE_LABEL[lastStage].toLowerCase() : 'babak ini';
  const when = (m: Match) => fmtWhen(m.iso).split(',').slice(0, 2).join(',');
  const lastText = last
    ? `${scoreLine(last)}${last.shootout ? ` (adu penalti ${last.shootout.juve}–${last.shootout.opp})` : ''}${
        aggregate ? ` · agregat ${aggregate.juve}–${aggregate.opp}` : ''
      } · ${when(last)}`
    : '';

  // Keterangan hanya muncul kalau perjalanan berakhir; selama masih lanjut, cukup nama babaknya.
  if (champion) return { big: 'Juara', tag: '', text: `Juara Coppa Italia: ${lastText}` };
  if (eliminated) return { big: label, tag: 'tidak lolos', text: `Tidak lolos dari ${lastLabel}: ${lastText}` };
  if (next) {
    return {
      big: label,
      tag: '',
      text: `${last ? `Terakhir: ${lastText}. ` : ''}Berikutnya: ${next.isHome ? 'vs' : 'di'} ${next.opponent} · ${when(next)}`,
    };
  }
  return { big: label, tag: '', text: `Lolos dari ${lastLabel}: ${lastText}. Lawan berikutnya belum ditentukan.` };
}

export function LeagueCards({
  serieA,
  europa,
  past,
  upcoming,
  loading,
}: {
  serieA: Team[];
  europa: Team[];
  past: Match[];
  upcoming: Match[];
  loading: boolean;
}) {
  const ofLeague = (list: Match[], slug: string) => list.filter((m) => m.league === slug);
  const isJuve = (t: Team) => t.name.includes('Juventus');

  const a = serieA.find(isJuve);
  const aLeader = serieA[0];
  const aSecond = serieA[1];

  const e = europa.find(isJuve);
  const euroPast = ofLeague(past, 'uefa.europa');
  const euroPlayed = e?.playedGames ?? euroPast.length;

  const coppa = coppaSummary(ofLeague(past, 'ita.coppa_italia'), ofLeague(upcoming, 'ita.coppa_italia'));

  const wait = loading ? 'Memuat data…' : 'Belum ada data';

  return (
    <div className="hm-cards">
      <article className="hm-card hm-serie">
        <div className="hm-card-label">Serie A</div>
        <div className="hm-card-big">
          {a ? (
            <>
              #{a.position} <small>{a.points} poin</small>
            </>
          ) : (
            '–'
          )}
        </div>
        <p>
          {a
            ? `${a.won}M · ${a.draw}S · ${a.lost}K · selisih gol ${fmtSigned(a.goalDifference)} · ${
                a.position === 1 && aSecond
                  ? `unggul ${a.points - aSecond.points} poin dari ${aSecond.name}`
                  : a.position === 1
                  ? 'memimpin klasemen'
                  : `${aLeader.points - a.points} poin di belakang ${aLeader.name}`
              }`
            : wait}
        </p>
        <Link href="/kompetisi?comp=seriea" className="hm-card-link">
          Lihat klasemen & jadwal →
        </Link>
      </article>

      <article className="hm-card hm-europa">
        <div className="hm-card-label">Liga Europa</div>
        <div className="hm-card-big">
          {e ? (
            <>
              #{e.position} <small>{e.points} poin</small>
            </>
          ) : (
            '–'
          )}
        </div>
        <p>
          {e
            ? `${
                euroPlayed >= EUROPA_LEAGUE_GAMES ? 'Fase liga selesai' : `Fase liga ${euroPlayed}/${EUROPA_LEAGUE_GAMES} laga`
              }${euroPast[0] ? ` · ${scoreLine(euroPast[0])}` : ''}`
            : wait}
        </p>
        <Link href="/kompetisi?comp=europa" className="hm-card-link">
          Lihat klasemen & jadwal →
        </Link>
      </article>

      <article className="hm-card hm-coppa">
        <div className="hm-card-label">Coppa Italia</div>
        <div className="hm-card-big">
          {loading ? (
            '–'
          ) : (
            <>
              {coppa.big} {coppa.tag && <small>{coppa.tag}</small>}
            </>
          )}
        </div>
        <p>{loading ? 'Memuat data…' : coppa.text}</p>
        <Link href="/kompetisi?comp=coppa" className="hm-card-link">
          Lihat jalur ke final →
        </Link>
      </article>
    </div>
  );
}

/* ---------- laga berikutnya + hitung mundur ---------- */

function useCountdown(iso: string | undefined) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    const target = new Date(iso).getTime();
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iso]);
  return left;
}

const two = (n: number) => String(n).padStart(2, '0');

export function NextMatchCard({ next, loading }: { next: Match | null; loading: boolean }) {
  const left = useCountdown(next?.iso);
  const secs = left === null ? null : Math.floor(left / 1000);
  const parts =
    secs === null
      ? ['–', '–', '–', '–']
      : [String(Math.floor(secs / 86400)), two(Math.floor((secs % 86400) / 3600)), two(Math.floor((secs % 3600) / 60)), two(secs % 60)];

  const home = next ? (next.isHome ? { name: 'Juventus', logo: JUVE_LOGO } : { name: next.opponent, logo: next.opponentLogo }) : null;
  const away = next ? (next.isHome ? { name: next.opponent, logo: next.opponentLogo } : { name: 'Juventus', logo: JUVE_LOGO }) : null;
  const weekday = next
    ? new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(next.iso))
    : '';

  return (
    <section className="hm-next">
      <header className="hm-next-head">
        <h2 className="hm-title">Laga berikutnya</h2>
        {next && (
          <span>
            {[next.venue, roundLabel(next).toLowerCase()].filter(Boolean).join(' · ')}
          </span>
        )}
      </header>

      {loading ? (
        <div className="hm-next-empty">Memuat jadwal…</div>
      ) : !next || !home || !away ? (
        <div className="hm-next-empty">Belum ada jadwal laga berikutnya.</div>
      ) : (
        <div className="hm-next-body">
          <span className="hm-next-comp">{next.competition.toUpperCase()}</span>
          <div className="hm-next-teams">
            <div className="hm-next-team">
              {home.logo && <img src={home.logo} alt="" />}
              <b>{home.name}</b>
            </div>
            <span className="hm-next-vs">vs</span>
            <div className="hm-next-team away">
              <b>{away.name}</b>
              {away.logo && <img src={away.logo} alt="" />}
            </div>
          </div>
          <div className="hm-next-when">
            {weekday} · {fmtClock(new Date(next.iso))} WIB
          </div>
          <div className="hm-next-actions">
            <a className="hm-dash" href="https://www.vidio.com" target="_blank" rel="noreferrer">
              <span aria-hidden>▶</span> Vidio?
            </a>
            <a className="hm-dash" href={calendarUrl(next)} target="_blank" rel="noreferrer">
              + Kalender
            </a>
          </div>
          <div className="hm-count" aria-label="Hitung mundur kick-off">
            {['Hari', 'Jam', 'Menit', 'Detik'].map((label, i) => (
              <div className="hm-count-box" key={label}>
                <b>{parts[i]}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- kalender gabungan ---------- */

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="3" fill="#fff" stroke="#6b7691" strokeWidth="1.6" />
      <path d="M3 10h18" stroke="#3b82f6" strokeWidth="4" />
      <path d="M8 3v4M16 3v4" stroke="#6b7691" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 14h2M11 14h2M14 14h2M8 17.5h2M11 17.5h2" stroke="#9aa5bd" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CombinedCalendar({ upcoming, loading, error, limit = 5 }: { upcoming: Match[]; loading: boolean; error: boolean; limit?: number }) {
  const list = upcoming.slice(0, limit);
  return (
    <section className="hm-cal">
      <header className="hm-cal-head">
        <h2 className="hm-title red">Kalender gabungan</h2>
        <small>{limit} laga ke depan, semua kompetisi</small>
      </header>

      {loading ? (
        <div className="kp-empty">Memuat jadwal…</div>
      ) : error ? (
        <div className="kp-empty">Jadwal belum bisa dimuat dari ESPN. Coba muat ulang halaman.</div>
      ) : list.length === 0 ? (
        <div className="kp-empty">Belum ada jadwal mendatang.</div>
      ) : (
        list.map((m) => {
          const pill = COMP_PILL[m.league] ?? { label: m.competition.toUpperCase(), cls: 'liga' };
          const sub = roundLabel(m);
          return (
            <div className="hm-cal-row" key={m.id}>
              <div className="hm-cal-when">
                <strong>{m.dateLabel}</strong>
                <span>{m.dayTime}</span>
              </div>
              <div className="hm-cal-opp">
                <small className={`hm-venue ${m.isHome ? 'home' : 'away'}`}>{m.venueText}</small>
                <div className="hm-cal-name">
                  {m.opponentLogo && <img src={m.opponentLogo} alt="" className="kp-logo" />}
                  {m.opponent}
                </div>
                {sub && <small className="hm-cal-sub">{sub}</small>}
              </div>
              <div className="hm-cal-actions">
                <span className={`hm-pill ${pill.cls}`}>{pill.label}</span>
                <a className="hm-vidio" href="https://www.vidio.com" target="_blank" rel="noreferrer">
                  <span aria-hidden>▶</span> Vidio · SCTV*
                </a>
                <a className="hm-ico" href={calendarUrl(m)} target="_blank" rel="noreferrer" aria-label={`Tambah ${m.opponent} ke kalender`}>
                  <CalendarIcon />
                </a>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
