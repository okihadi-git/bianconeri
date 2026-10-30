'use client';

import { useEffect, useState } from 'react';
import { fmtClock, fmtWhen, shortRound } from '@/components/kp';
import type { Lineup, LineupPlayer, LiveMatch, LiveResponse, LiveSide, Match, ScorerLine, TimelineItem } from '@/lib/types';

const TABS = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'lineup', label: 'Susunan pemain' },
  { key: 'stats', label: 'Statistik' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const LIVE_POLL_MS = 30_000;
const IDLE_POLL_MS = 120_000;

/** Ambil /api/live berkala: cepat saat laga berjalan, santai saat tidak ada laga. */
function useLive() {
  const [state, setState] = useState<{ data: LiveResponse | null; loading: boolean; error: boolean }>({
    data: null,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      let delay = IDLE_POLL_MS;
      try {
        const res = await fetch('/api/live', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || json?.error) throw new Error('live');
        if (!cancelled) setState({ data: json as LiveResponse, loading: false, error: false });
        if ((json as LiveResponse).match?.state === 'live') delay = LIVE_POLL_MS;
      } catch {
        if (!cancelled) setState((p) => ({ data: p.data, loading: false, error: true }));
      }
      if (!cancelled) timer = setTimeout(load, delay);
    };

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return state;
}

const num = (v: string) => parseFloat(String(v).replace(/[^\d.]/g, '')) || 0;
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const PARTICLES = new Set(['di', 'de', 'da', 'del', 'della', 'van', 'von', 'dos', 'le', 'la', 'el', 'al', 'ter']);
/** "Michele Di Gregorio" → "Di Gregorio" */
const lastName = (n: string) => {
  const parts = n.trim().split(/\s+/);
  let i = parts.length - 1;
  while (i > 0 && PARTICLES.has(parts[i - 1].toLowerCase())) i--;
  return parts.slice(i).join(' ') || n;
};

/* ---------- potongan kecil ---------- */

function Crest({ side }: { side: LiveSide }) {
  return side.logo ? <img src={side.logo} alt="" className="lv-crest" /> : <span className="lv-crest lv-crest-ph">{side.abbr}</span>;
}

function Scorers({ list, align }: { list: ScorerLine[]; align: 'left' | 'right' }) {
  if (!list.length) return <div className="lv-scorers" />;
  return (
    <div className={`lv-scorers ${align}`}>
      {list.map((s, i) => (
        <span key={i} className="lv-scorer">
          <i className="kp-ball" />
          {s.name} {s.minute}
          {s.tag ? ` (${s.tag})` : ''}
        </span>
      ))}
    </div>
  );
}

function EventIcon({ kind }: { kind: TimelineItem['kind'] }) {
  if (kind === 'yellow') return <i className="lv-yc" />;
  if (kind === 'red') return <i className="kp-red-card" />;
  if (kind === 'sub') return <span className="lv-sub-ico">⇄</span>;
  if (kind === 'pen-miss') return <span className="lv-miss">✕</span>;
  return <i className="kp-ball" />;
}

function EventText({ it }: { it: TimelineItem }) {
  if (it.kind === 'sub') {
    return (
      <div className="lv-ev-text">
        <b className="lv-in">▲ {it.player}</b>
        {it.related && <small className="lv-out">▼ {it.related}</small>}
      </div>
    );
  }
  const tag = it.kind === 'pen-goal' ? ' (pen)' : it.kind === 'own-goal' ? ' (b.d.)' : '';
  return (
    <div className="lv-ev-text">
      <b>
        {it.player || it.label}
        {tag}
      </b>
      {it.kind === 'pen-miss' && <small>Penalti gagal</small>}
      {it.related && (it.kind === 'goal' || it.kind === 'pen-goal') && <small>assist: {it.related}</small>}
      {it.kind === 'red' && it.label === 'Kuning kedua' && <small>Kuning kedua</small>}
    </div>
  );
}

/* ---------- timeline ---------- */

function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <div className="kp-empty">Belum ada kejadian penting.</div>;
  return (
    <ol className="lv-tl">
      {items.map((it) =>
        it.kind === 'period' ? (
          <li key={it.id} className="lv-tl-period">
            <span>{it.label}</span>
          </li>
        ) : (
          <li key={it.id} className="lv-tl-row">
            <div className="lv-tl-side home">
              {it.side === 'home' && (
                <>
                  <EventText it={it} />
                  <EventIcon kind={it.kind} />
                </>
              )}
            </div>
            <div className="lv-tl-min">{it.minute}</div>
            <div className="lv-tl-side away">
              {it.side === 'away' && (
                <>
                  <EventIcon kind={it.kind} />
                  <EventText it={it} />
                </>
              )}
            </div>
          </li>
        )
      )}
    </ol>
  );
}

/* ---------- susunan pemain ---------- */

/** Cadangan bila formasi tidak bisa dibaca: kelompokkan dari kode posisi. */
function groupOf(pos: string): 0 | 1 | 2 | 3 {
  const p = pos.toUpperCase();
  if (p.startsWith('G')) return 0;
  if (/WB|CD|CB|^D|LB|RB|SW/.test(p)) return 1;
  if (/^(F|CF|ST|SS|LF|RF|LW|RW|W)/.test(p)) return 3;
  return 2;
}

function pitchRows(lineup: Lineup): LineupPlayer[][] {
  const st = lineup.starters;
  if (!st.length) return [];
  const gkIdx = Math.max(0, st.findIndex((p) => p.position.toUpperCase().startsWith('G')));
  const gk = st[gkIdx];
  const rest = st.filter((_, i) => i !== gkIdx);

  const digits = /^\d(?:-\d)+$/.test(lineup.formation) ? lineup.formation.split('-').map(Number) : [];
  if (digits.length && digits.reduce((a, b) => a + b, 0) === rest.length) {
    const rows: LineupPlayer[][] = [[gk]];
    let at = 0;
    for (const n of digits) {
      rows.push(rest.slice(at, at + n));
      at += n;
    }
    return rows;
  }
  const rows: LineupPlayer[][] = [[gk], [], [], []];
  rest.forEach((p) => rows[Math.max(1, groupOf(p.position))].push(p));
  return rows.filter((r) => r.length);
}

function Pitch({ lineup, juve }: { lineup: Lineup; juve: boolean }) {
  const rows = pitchRows(lineup);
  if (!rows.length) return <div className="kp-empty">Susunan pemain belum tersedia.</div>;
  return (
    <div className="lv-pitch">
      <div className="lv-pitch-lines" aria-hidden />
      {[...rows].reverse().map((row, i) => (
        <div className="lv-pitch-row" key={i}>
          {row.map((p) => (
            <div className="lv-node" key={p.id}>
              <div className={`lv-shirt ${juve ? 'juve' : 'opp'}`}>
                {p.jersey || '–'}
                {p.goals > 0 && <span className="lv-badge lv-b-goal">⚽{p.goals > 1 ? p.goals : ''}</span>}
                {p.red > 0 ? (
                  <span className="lv-badge lv-b-card"><i className="kp-red-card" /></span>
                ) : p.yellow > 0 ? (
                  <span className="lv-badge lv-b-card"><i className="lv-yc" /></span>
                ) : null}
              </div>
              <span className="lv-node-name">{lastName(p.name)}</span>
              {p.subOff && <span className="lv-node-off">▼ {p.subOff}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Lineups({ m }: { m: LiveMatch }) {
  const [side, setSide] = useState<'home' | 'away'>(m.home.isJuve ? 'home' : 'away');
  const lineup = m.lineups[side];
  const team = side === 'home' ? m.home : m.away;

  if (!m.lineups.home && !m.lineups.away) {
    return <div className="kp-empty">Susunan pemain belum diumumkan di ESPN.</div>;
  }
  return (
    <div className="lv-lineup">
      <div className="lv-seg" role="tablist">
        {(['home', 'away'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={side === s}
            className={`lv-seg-btn${side === s ? ' active' : ''}`}
            onClick={() => setSide(s)}
          >
            {s === 'home' ? m.home.name : m.away.name}
          </button>
        ))}
      </div>

      {!lineup ? (
        <div className="kp-empty">Susunan {team.name} belum tersedia.</div>
      ) : (
        <div className="lv-lineup-grid">
          <div>
            <div className="lv-formation">Formasi {lineup.formation || '–'}</div>
            <Pitch lineup={lineup} juve={team.isJuve} />
          </div>
          <div>
            <div className="lv-formation">Cadangan</div>
            {lineup.subs.length === 0 ? (
              <div className="kp-muted">Belum ada data cadangan.</div>
            ) : (
              <ul className="lv-subs">
                {lineup.subs.map((p) => (
                  <li key={p.id} className={p.subOn ? 'used' : ''}>
                    <span className="lv-sub-num">{p.jersey || '–'}</span>
                    <span className="lv-sub-name">{p.name}</span>
                    {p.goals > 0 && <span>⚽</span>}
                    {p.red > 0 ? <i className="kp-red-card" /> : p.yellow > 0 ? <i className="lv-yc" /> : null}
                    {p.subOn && <span className="lv-in">▲ {p.subOn}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- statistik ---------- */

function Stats({ m }: { m: LiveMatch }) {
  if (!m.stats.length) return <div className="kp-empty">Statistik pertandingan belum tersedia di ESPN.</div>;
  return (
    <div className="kp-stats lv-stats">
      <div className="kp-stats-head">
        <b>{m.home.name}</b>
        <b>{m.away.name}</b>
      </div>
      {m.stats.map((s) => {
        const a = num(s.home);
        const b = num(s.away);
        const share = a + b === 0 ? 50 : (a / (a + b)) * 100;
        return (
          <div className="kp-stat" key={s.key}>
            <span className="kp-stat-v">{s.home}</span>
            <div className="kp-stat-mid">
              <span className="kp-stat-label">{s.label}</span>
              <div className="kp-stat-bar">
                <i style={{ width: `${share}%` }} />
              </div>
            </div>
            <span className="kp-stat-v">{s.away}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- kartu utama ---------- */

function MatchBody({ m }: { m: LiveMatch }) {
  const [tab, setTab] = useState<TabKey>('timeline');
  const live = m.state === 'live';
  const round = m.round ? shortRound(m.round) : '';

  return (
    <div className="lv-body">
      <div className="lv-meta">
        {m.competition}
        {round ? ` · ${round}` : ''} · {titleCase(m.dateLabel)} · {m.dayTime.split(' · ')[1]} WIB
      </div>

      <div className="lv-score">
        <div className="lv-team">
          <Crest side={m.home} />
          <b className={m.home.isJuve ? 'me' : ''}>{m.home.name}</b>
          <Scorers list={m.scorers.home} align="left" />
        </div>

        <div className="lv-mid">
          <div className="lv-num">
            <span>{m.home.score}</span>
            <i>–</i>
            <span>{m.away.score}</span>
          </div>
          {m.shootout && (
            <small className="lv-pen">
              adu penalti {m.shootout.home}–{m.shootout.away}
            </small>
          )}
          <span className={`lv-status${live ? ' live' : ''}`}>{m.statusText}</span>
        </div>

        <div className="lv-team">
          <Crest side={m.away} />
          <b className={m.away.isJuve ? 'me' : ''}>{m.away.name}</b>
          <Scorers list={m.scorers.away} align="left" />
        </div>
      </div>

      <div className="kp-tabs lv-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`kp-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="lv-panel">
        {tab === 'timeline' && <Timeline items={m.timeline} />}
        {tab === 'lineup' && <Lineups m={m} />}
        {tab === 'stats' && <Stats m={m} />}
      </div>

      <div className="kp-detail-foot lv-foot">
        <span className="kp-muted">
          {[m.venue, m.referee ? `Wasit: ${m.referee}` : '', m.attendance ? `${m.attendance.toLocaleString('id-ID')} penonton` : '']
            .filter(Boolean)
            .join(' · ')}
        </span>
        <a href={`https://www.espn.com/soccer/match/_/gameId/${m.id}`} target="_blank" rel="noreferrer">
          Detail pertandingan ↗
        </a>
      </div>
    </div>
  );
}

export default function LiveScore({ next }: { next: Match | null }) {
  const { data, loading, error } = useLive();
  const match = data?.match ?? null;
  const updated = data?.updatedAt ? fmtClock(new Date(data.updatedAt)) : '';

  return (
    <section className="kp-card lv" aria-live="polite">
      <header className="lv-head">
        <h2 className="lv-title">
          <span className={`lv-dot${match?.state === 'live' ? ' on' : ''}`} aria-hidden />
          Skor live
        </h2>
        <small className="kp-muted">{updated ? `Diperbarui ${updated} WIB` : ''}</small>
      </header>

      {loading ? (
        <div className="kp-empty">Memuat skor…</div>
      ) : match ? (
        <MatchBody key={match.id} m={match} />
      ) : (
        <div className="lv-idle">
          {error ? 'Skor belum bisa dimuat dari ESPN. ' : 'Tidak ada laga Juventus yang sedang berlangsung. '}
          {next ? (
            <>
              Laga berikutnya:{' '}
              <b>
                {next.isHome ? 'Juventus' : next.opponent} vs {next.isHome ? next.opponent : 'Juventus'}
              </b>{' '}
              · {next.competition} · {fmtWhen(next.iso)}
            </>
          ) : (
            'Belum ada jadwal laga berikutnya.'
          )}
        </div>
      )}
    </section>
  );
}
