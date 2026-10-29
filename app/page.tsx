'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Match, Team } from '@/lib/types';

type MatchDetail = {
  stats?: { key: string; label: string; juve: string; opp: string }[];
  timeline?: { minute: string; type: string; teamId: string; player: string; secondaryPlayer: string; isJuve: boolean }[];
  lineups?: { team: string; teamId: string; isJuve: boolean; groups: { name: string; position: string; jersey: string; starter: boolean; subbedIn: boolean; subbedOut: boolean }[] }[];
  venue?: string; attendance?: number | null; referee?: string; opponent?: string; status?: string;
};

const TZ = 'Asia/Jakarta';
const dateTime = (iso: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }).format(new Date(iso)) + ' WIB';
const compName: Record<string, string> = { 'ita.1': 'Serie A', 'uefa.europa': 'Liga Europa', 'uefa.champions': 'Liga Champions', 'ita.coppa_italia': 'Coppa Italia', 'ita.super_cup': 'Supercoppa Italiana' };

export default function Home() {
  const [matches, setMatches] = useState<{ upcoming: Match[]; past: Match[] } | null>(null);
  const [tables, setTables] = useState<Record<string, Team[]>>({});
  const [details, setDetails] = useState<Record<string, MatchDetail | { error: true }>>({});
  const [openMatch, setOpenMatch] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    fetch('/api/juventus').then(r => r.json()).then(d => { if (!cancelled) setMatches({ upcoming: d.upcoming ?? [], past: d.past ?? [] }); }).catch(() => {});
    for (const league of ['ita.1', 'uefa.europa']) {
      fetch(`/api/standings?league=${league}`).then(r => r.json()).then(d => { if (!cancelled) setTables(p => ({ ...p, [league]: d.standings ?? [] })); }).catch(() => {});
    }
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => { cancelled = true; clearInterval(tick); };
  }, []);

  const recent = useMemo(() => (matches?.past ?? []).find(m => now - new Date(m.iso).getTime() < 48 * 3600 * 1000), [matches, now]);
  const live = useMemo(() => (matches?.upcoming ?? []).find(m => {
    const kick = new Date(m.iso).getTime(); return kick <= now && now - kick < 3 * 3600 * 1000;
  }), [matches, now]);
  const feature = live ?? recent;
  const next = useMemo(() => (matches?.upcoming ?? []).filter(m => new Date(m.iso).getTime() > now).sort((a,b) => +new Date(a.iso)-+new Date(b.iso))[0], [matches, now]);
  const schedule = useMemo(() => [...(matches?.upcoming ?? [])].filter(m => new Date(m.iso).getTime() > now).sort((a,b) => +new Date(a.iso)-+new Date(b.iso)).slice(0, 6), [matches, now]);

  async function toggleDetail(match: Match) {
    if (openMatch === match.id) { setOpenMatch(null); return; }
    setOpenMatch(match.id);
    if (details[match.id]) return;
    setLoadingDetail(match.id);
    try {
      const r = await fetch(`/api/match/${match.id}?league=${encodeURIComponent(match.league)}`);
      const d = await r.json();
      if (!r.ok) throw new Error('detail');
      setDetails(p => ({ ...p, [match.id]: d }));
    } catch { setDetails(p => ({ ...p, [match.id]: { error: true } })); }
    finally { setLoadingDetail(null); }
  }

  const competitionCards = [
    { slug: 'ita.1', title: 'Serie A', sub: 'Klasemen liga', type: 'table' },
    { slug: 'uefa.europa', title: 'Liga Europa', sub: 'Fase liga', type: 'table' },
    { slug: 'ita.coppa_italia', title: 'Coppa Italia', sub: 'Turnamen gugur', type: 'cup' },
  ];

  return <div className="home-dashboard">
    <section className="home-section home-live">
      <div className="home-section-head"><h2><span className="live-pulse" /> Skor live & hasil terbaru</h2><small>Data otomatis dari ESPN · WIB</small></div>
      {feature ? <>
        <div className="home-match-score">
          <div className="home-team"><img src="https://a.espncdn.com/i/teamlogos/soccer/500/111.png" alt="Juventus"/><strong>Juventus</strong><small>{feature.isHome ? 'Kandang' : 'Tandang'}</small></div>
          <div className="home-score"><strong>{feature.juveScore} – {feature.opponentScore}</strong><span className={live ? 'status-live' : 'status-done'}>{live ? 'SEDANG BERLANGSUNG' : 'SELESAI'} · {compName[feature.league] ?? feature.competition}</span><small>{dateTime(feature.iso)}</small></div>
          <div className="home-team"><img src={feature.opponentLogo || ''} alt=""/><strong>{feature.opponent}</strong><small>{feature.isHome ? 'Tandang' : 'Kandang'}</small></div>
        </div>
        <div className="home-event-strip">{feature.events?.length ? feature.events.map((e,i) => <span key={`${e.name}-${e.minute}-${i}`}>{e.kind === 'goal' ? '⚽' : '🟥'} {e.name || (e.kind === 'goal' ? 'Gol' : 'Kartu merah')} <b>{e.minute}</b></span>) : <span>{live ? 'Detail kejadian akan muncul jika disediakan sumber data.' : 'Ringkasan kejadian tersedia melalui detail pertandingan.'}</span>}</div>
        <div className="home-detail-action"><span>{feature.venue || 'Lokasi pertandingan'}</span><button onClick={() => toggleDetail(feature)}>{openMatch === feature.id ? 'Tutup detail ↑' : 'Timeline · Line-up · Statistik ↓'}</button></div>
        {openMatch === feature.id && <MatchDetailView detail={details[feature.id]} loading={loadingDetail === feature.id} />}
      </> : <div className="home-empty">Belum ada pertandingan Juventus yang sedang berlangsung atau selesai dalam 48 jam terakhir.</div>}
    </section>

    <section className="home-section">
      <div className="home-section-head"><h2>Ringkasan kompetisi</h2><a href="/kompetisi">Lihat semua kompetisi →</a></div>
      <div className="home-competition-grid">{competitionCards.map(c => {
        const standings = tables[c.slug] ?? [];
        const row = standings.find(t => /juventus/i.test(t.name));
        const leader = standings[0];
        const latest = (matches?.past ?? []).find(m => m.league === c.slug);
        const upcomingCup = (matches?.upcoming ?? []).find(m => m.league === c.slug);
        return <article className={`home-comp-card comp-${c.type}`} key={c.slug}>
          <span className="home-comp-label">{c.title}</span>
          {c.type === 'table' ? <><div className="home-comp-rank">#{row?.position ?? '–'} <small>{row ? `${row.points} poin` : 'Memuat klasemen…'}</small></div><p>{row ? `${row.playedGames} laga · ${row.won} menang · selisih gol ${row.goalDifference > 0 ? '+' : ''}${row.goalDifference}` : 'Posisi Juventus belum tersedia dari feed klasemen.'}</p>{row && leader && <p className="home-comp-muted">{row.position === 1 ? 'Memimpin klasemen' : `${Math.max(0, leader.points - row.points)} poin dari pemuncak: ${leader.name}`}</p>}</> : <><div className="home-comp-rank">Coppa <small>Italia</small></div><p>{latest ? `Laga terakhir: ${latest.juveScore}–${latest.opponentScore} vs ${latest.opponent}` : upcomingCup ? `Berikutnya: vs ${upcomingCup.opponent}` : 'Babak dan hasil terbaru akan ditampilkan saat tersedia.'}</p><p className="home-comp-muted">Format gugur · tidak memiliki klasemen liga</p></>}
          <a href="/kompetisi">Lihat klasemen & jadwal →</a>
        </article>;
      })}</div>
    </section>

    <div className="home-bottom-grid">
      <section className="home-section home-next">
        <div className="home-section-head"><h2>Jadwal Juventus berikutnya</h2><a href="/kompetisi">Semua jadwal →</a></div>
        {next ? <div className="home-next-feature"><span className="home-comp-label">{compName[next.league] ?? next.competition}</span><div className="home-next-teams"><div><img src="https://a.espncdn.com/i/teamlogos/soccer/500/111.png" alt=""/><b>Juventus</b></div><strong>VS</strong><div><img src={next.opponentLogo || ''} alt=""/><b>{next.opponent}</b></div></div><p>{dateTime(next.iso)} · {next.venue || 'Venue belum dikonfirmasi'}</p><a href="/kompetisi">Buka kalender kompetisi →</a></div> : <div className="home-empty">Jadwal berikutnya belum tersedia.</div>}
      </section>
      <section className="home-section home-calendar">
        <div className="home-section-head"><h2>Kalender gabungan</h2><small>{schedule.length} pertandingan mendatang</small></div>
        {schedule.length ? schedule.map(m => <div className="home-calendar-row" key={m.id}><div className="home-calendar-date"><b>{new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',timeZone:TZ}).format(new Date(m.iso))}</b><small>{new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:TZ}).format(new Date(m.iso))} WIB</small></div><img src={m.opponentLogo || ''} alt=""/><div className="home-calendar-opponent"><b>{m.isHome ? 'vs' : '@'} {m.opponent}</b><small>{compName[m.league] ?? m.competition}</small></div><span className="home-venue-tag">{m.venueText}</span></div>) : <div className="home-empty">Tidak ada jadwal yang ditemukan.</div>}
      </section>
    </div>
  </div>;
}

function MatchDetailView({ detail, loading }: { detail?: MatchDetail | { error: true }; loading: boolean }) {
  if (loading) return <div className="home-detail-body">Memuat timeline, line-up, dan statistik…</div>;
  if (!detail) return null;
  if ('error' in detail) return <div className="home-detail-body">Detail pertandingan belum bisa diambil dari sumber data.</div>;
  return <div className="home-detail-body">
    <div className="home-detail-grid">
      <section><h3>Timeline pertandingan</h3>{detail.timeline?.length ? detail.timeline.map((e,i)=><div className="home-timeline-row" key={`${e.minute}-${i}`}><b>{e.minute || '—'}</b><span>{e.isJuve ? '⚪⚫' : '🔵'} {e.type}: {e.player || 'Pemain tidak tercatat'}{e.secondaryPlayer ? ` · ${e.secondaryPlayer}` : ''}</span></div>) : <p>Timeline kejadian tidak tersedia.</p>}</section>
      <section><h3>Statistik</h3>{detail.stats?.length ? detail.stats.map(s=><div className="home-stat-row" key={s.key}><span>{s.juve}</span><b>{s.label}</b><span>{s.opp}</span></div>) : <p>Statistik pertandingan tidak tersedia.</p>}</section>
    </div>
    <section className="home-lineups"><h3>Line-up</h3>{detail.lineups?.length ? <div className="home-lineup-grid">{detail.lineups.map(t=><div key={t.teamId}><h4>{t.team}</h4>{t.groups.filter(p=>p.starter).map((p,i)=><div className="home-player-row" key={`${p.jersey}-${i}`}><span>{p.jersey || '—'}</span>{p.name} <small>{p.position}</small></div>)}{!t.groups.some(p=>p.starter) && <p>Susunan pemain tidak tersedia pada feed.</p>}</div>)}</div> : <p>Susunan pemain belum tersedia dari feed ESPN untuk pertandingan ini.</p>}</section>
    <div className="home-match-meta">{detail.venue && <span>Stadion: {detail.venue}</span>}{detail.attendance != null && <span>Penonton: {Number(detail.attendance).toLocaleString('id-ID')}</span>}{detail.referee && <span>Wasit: {detail.referee}</span>}</div>
  </div>;
}
