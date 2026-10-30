'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  EUROPA_ZONES,
  FormBadges,
  MatchesCard,
  RESULT_WORD,
  SERIE_A_ZONES,
  ScheduleCard,
  ScorersCard,
  StandingsCard,
  fmtDecimal,
  fmtSigned,
  useFetch,
  type ZoneDef,
} from '@/components/kp';
import type { Letter, Match, PlayerStat, SimpleMatch, Team } from '@/lib/types';

interface Comp {
  key: string;
  slug: string | null;
  icon: string;
  label: string;
  /** punya tabel klasemen? (Coppa Italia = sistem gugur, tidak ada) */
  table: boolean;
  zones: ZoneDef[];
}

const COMPS: Comp[] = [
  { key: 'seriea', slug: 'ita.1', icon: '🇮🇹', label: 'Serie A', table: true, zones: SERIE_A_ZONES },
  { key: 'europa', slug: 'uefa.europa', icon: '🇪🇺', label: 'Liga Europa', table: true, zones: EUROPA_ZONES },
  { key: 'coppa', slug: 'ita.coppa_italia', icon: '🏆', label: 'Coppa Italia', table: false, zones: [] },
  { key: 'supercoppa', slug: null, icon: '🛡️', label: 'Supercoppa Italiana', table: false, zones: [] },
  { key: 'tour', slug: null, icon: '✈️', label: 'Pramusim & Tur', table: false, zones: [] },
];

const BASE_SUB_TABS = [
  { key: 'klasemen', label: 'Klasemen & jadwal' },
  { key: 'lagalain', label: 'Laga lain' },
  { key: 'topskor', label: 'Top skor' },
] as const;

const SERIE_A_EXTRA_TABS = [
  { key: 'trofi', label: 'Jalan ke trofi' },
  { key: 'peluang', label: 'Peluang juara' },
  { key: 'gelar', label: 'Perebutan gelar' },
  { key: 'laju', label: 'Laju poin' },
] as const;

type SubKey = (typeof BASE_SUB_TABS)[number]['key'] | (typeof SERIE_A_EXTRA_TABS)[number]['key'];

interface TrophyStepDef {
  roundCode: string;
  roundName: string;
}

// Urutan babak standar Coppa Italia
const COPPA_ROUNDS: TrophyStepDef[] = [
  { roundCode: 'R16', roundName: 'ROUND OF 16' },
  { roundCode: 'QF', roundName: 'PEREMPAT FINAL' },
  { roundCode: 'SF', roundName: 'SEMIFINAL (2 LEG)' },
  { roundCode: 'F', roundName: 'FINAL' },
];

interface JalurKeRomaProps {
  pastMatches: Match[];
  upcomingMatches: Match[];
  loading: boolean;
}

// Komponen Otomatis Jalur Ke Roma untuk Coppa Italia
function JalurKeRomaCard({ pastMatches, upcomingMatches, loading }: JalurKeRomaProps) {
  const sortedPast = useMemo(() => [...pastMatches].reverse(), [pastMatches]);

  const isEliminated = useMemo(() => {
    return sortedPast.some((m) => m.result === 'L');
  }, [sortedPast]);

  const allJuveCoppaMatches = useMemo(() => {
    return [...sortedPast, ...upcomingMatches];
  }, [sortedPast, upcomingMatches]);

  if (loading) {
    return <div className="kp-card kp-empty">Memuat data Jalur ke Roma…</div>;
  }

  return (

    
    <div className="kp-card">
  {/* Header kartu yang sudah disamakan fontnya dengan gambar 2 */}
  <div className="kp-card-header">
    <h2 className="kp-card-title">Jalur ke Roma</h2>
    <span className="kp-card-sub">Sistem gugur · data ESPN</span>
  </div>

      {/* Timeline Container */}
      <div className="kp-timeline">
        {COPPA_ROUNDS.map((roundDef, idx) => {
          const matchData = allJuveCoppaMatches[idx];
          const isPast = matchData && sortedPast.includes(matchData);
          const isNext = !isPast && matchData && !isEliminated && idx === sortedPast.length;

          let status: 'done' | 'next' | 'upcoming' | 'eliminated' = 'upcoming';
          if (isPast) {
            status = matchData.result === 'W' ? 'done' : 'eliminated';
          } else if (isNext) {
            status = 'next';
          } else if (isEliminated && idx >= sortedPast.length) {
            status = 'eliminated';
          }

          const opponentText = matchData
            ? ` · ${matchData.opponent.toUpperCase()} (${matchData.isHome ? 'K' : 'T'})`
            : '';
          const titleText = `${roundDef.roundName}${opponentText}`;

          return (
            <div key={roundDef.roundCode} className="kp-timeline-item">
              {/* Node Bulatan */}
              <div className={`kp-timeline-node ${status}`}>
                {status === 'done' ? '✓' : roundDef.roundCode}
              </div>

              {/* Detail Konten */}
              <div className="kp-timeline-content">
                <div className="kp-timeline-header">
                  <div>
                    <h3 className={`kp-timeline-title ${status === 'upcoming' || status === 'eliminated' ? 'disabled' : ''}`}>
                      {titleText}
                    </h3>
                    <p className="kp-timeline-date">
                      {matchData ? `${matchData.dateLabel} · ${matchData.dayTime}` : 'Belum dijadwalkan'}
                    </p>
                  </div>

                  {/* Skor Jika Sudah Dimainkan */}
                  {isPast && matchData && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 800 }}>
                        {matchData.juveScore}–{matchData.opponentScore}
                      </span>
                      <span className={`kp-badge ${matchData.result === 'W' ? 'w' : 'l'}`}>
                        {RESULT_WORD[matchData.result as Letter] || matchData.result}
                      </span>
                    </div>
                  )}

                  {/* Label BERIKUTNYA */}
                  {status === 'next' && (
                    <span className="kp-badge-next">
                      BERIKUTNYA
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formOf(matches: Match[]): Letter[] {
  return matches
    .slice(0, 5)
    .map((m) => m.result as Letter)
    .reverse();
}

function KompetisiInner() {
  const compParam = useSearchParams().get('comp');
  const [compKey, setCompKey] = useState(COMPS.some((c) => c.key === compParam) ? (compParam as string) : 'seriea');
  const [tab, setTab] = useState<SubKey>('klasemen');
  const comp = COMPS.find((c) => c.key === compKey)!;

  const availableTabs = useMemo(() => {
    return compKey === 'seriea' ? [...BASE_SUB_TABS, ...SERIE_A_EXTRA_TABS] : BASE_SUB_TABS;
  }, [compKey]);

  // Fallback state jika berpindah dari Serie A saat di tab ekstra
  useEffect(() => {
    if (compKey !== 'seriea' && SERIE_A_EXTRA_TABS.some((t) => t.key === tab)) {
      setTab('klasemen');
    }
  }, [compKey, tab]);

  const juveRes = useFetch<{ upcoming: Match[]; past: Match[] }>('/api/juventus');
  const upcoming = useMemo(
    () => (juveRes.data?.upcoming ?? []).filter((m) => m.league === comp.slug),
    [juveRes.data, comp.slug]
  );
  const past = useMemo(
    () => (juveRes.data?.past ?? []).filter((m) => m.league === comp.slug),
    [juveRes.data, comp.slug]
  );

  const standingsRes = useFetch<{ standings: Team[]; week: number; updatedAt: string | null }>(
    comp.slug && comp.table ? `/api/standings?league=${comp.slug}` : null
  );

  const needsCompetition = tab === 'lagalain' || tab === 'topskor' || (tab === 'klasemen' && !comp.table);
  const competitionRes = useFetch<{ matches: SimpleMatch[]; topScorers: PlayerStat[] }>(
    comp.slug && needsCompetition ? `/api/competition?league=${comp.slug}` : null
  );

  const standings = standingsRes.data?.standings ?? [];
  const juve = standings.find((t) => t.name.includes('Juventus'));
  const leader = standings[0];
  const last = past[0];
  const next = upcoming[0];

  const updatedLabel = standingsRes.data?.updatedAt
    ? new Date(standingsRes.data.updatedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      })
    : null;

  const played = past.length;
  const won = past.filter((m) => m.result === 'W').length;
  const drawn = past.filter((m) => m.result === 'D').length;
  const lost = past.filter((m) => m.result === 'L').length;
  const gf = past.reduce((n, m) => n + m.juveScore, 0);
  const ga = past.reduce((n, m) => n + m.opponentScore, 0);
  const lastSentence = last
    ? `Terakhir: ${RESULT_WORD[last.result as Letter]} ${last.juveScore}–${last.opponentScore} vs ${last.opponent}`
    : 'Belum ada laga yang dimainkan';

  const tabLabel = (k: SubKey, fallback: string) => {
    if (k === 'klasemen') {
      if (compKey === 'coppa') return 'Jalur ke Roma';
      if (!comp.table) return 'Pertandingan & jadwal';
    }
    return fallback;
  };

  const hasData = Boolean(comp.slug);

  return (
    <div className="kp">
      {/* Kompetisi */}
      <div className="kp-comps">
        {COMPS.map((c) => (
          <button key={c.key} className={`kp-comp${compKey === c.key ? ' active' : ''}`} onClick={() => setCompKey(c.key)}>
            <span aria-hidden>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <div className="kp-card kp-empty">Data {comp.label} belum tersedia.</div>
      ) : (
        <>
          {/* Ringkasan */}
          {comp.table ? (
            <div className="kp-metrics">
              <div className="kp-metric kp-metric-purple">
                <div className="kp-metric-label">Posisi</div>
                <div className="kp-metric-val">#{juve ? juve.position : '–'}</div>
                <div className="kp-metric-sub">
                  {!juve
                    ? standingsRes.loading
                      ? 'Memuat data…'
                      : 'Belum ada di klasemen'
                    : juve.position === 1
                    ? 'Memimpin klasemen'
                    : `${leader.points - juve.points} poin di belakang ${leader.name}`}
                </div>
              </div>
              <div className="kp-metric">
                <div className="kp-metric-label">Poin</div>
                <div className="kp-metric-val">{juve ? juve.points : '–'}</div>
                <div className="kp-metric-sub">
                  {juve ? `${juve.won}M · ${juve.draw}S · ${juve.lost}K dari ${juve.playedGames} laga` : 'Memuat data…'}
                </div>
              </div>
              <div className="kp-metric">
                <div className="kp-metric-label">Gol</div>
                <div className="kp-metric-val">{juve ? `${juve.goalsFor}-${juve.goalsAgainst}` : '–'}</div>
                <div className="kp-metric-sub">
                  {juve
                    ? `Selisih ${fmtSigned(juve.goalDifference)} · ${fmtDecimal(juve.goalsFor / (juve.playedGames || 1))} gol per laga`
                    : 'Memuat data…'}
                </div>
              </div>
              <div className="kp-metric">
                <div className="kp-metric-label">Form 5 laga</div>
                <div className="kp-metric-hint">lama → terbaru</div>
                <FormBadges form={juve?.form?.length ? juve.form : formOf(past)} />
                <div className="kp-metric-sub">{lastSentence}</div>
              </div>
            </div>
          ) : (
            <div className="kp-metrics">
              <div className="kp-metric kp-metric-purple">
                <div className="kp-metric-label">Laga dimainkan</div>
                <div className="kp-metric-val">{played}</div>
                <div className="kp-metric-sub">{played ? `${won}M · ${drawn}S · ${lost}K` : 'Belum ada laga'}</div>
              </div>
              <div className="kp-metric">
                <div className="kp-metric-label">Gol</div>
                <div className="kp-metric-val">{played ? `${gf}-${ga}` : '–'}</div>
                <div className="kp-metric-sub">
                  {played ? `Selisih ${fmtSigned(gf - ga)} · ${fmtDecimal(gf / played)} gol per laga` : 'Belum ada gol'}
                </div>
              </div>
              <div className="kp-metric">
                <div className="kp-metric-label">Laga berikutnya</div>
                <div className="kp-metric-val">{next ? next.dateLabel : '–'}</div>
                <div className="kp-metric-sub">
                  {next ? `${next.isHome ? 'vs' : '@'} ${next.opponent} · ${next.dayTime}` : juveRes.loading ? 'Memuat data…' : 'Belum dijadwalkan'}
                </div>
              </div>
              <div className="kp-metric">
                <div className="kp-metric-label">Form {comp.label}</div>
                <div className="kp-metric-hint">lama → terbaru</div>
                <FormBadges form={formOf(past)} />
                <div className="kp-metric-sub">{lastSentence}</div>
              </div>
            </div>
          )}

          {/* Sub tab */}
          <div className="kp-tabs" role="tablist">
            {availableTabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`kp-tab${tab === t.key ? ' active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {tabLabel(t.key, t.label)}
              </button>
            ))}
          </div>

          {tab === 'klasemen' && (
            compKey === 'coppa' ? (
              <JalurKeRomaCard pastMatches={past} upcomingMatches={upcoming} loading={juveRes.loading} />
            ) : comp.table ? (
              <div className="kp-grid">
                <StandingsCard
                  subtitle={`${
                    standingsRes.data?.week ? `Setelah ${comp.key === 'europa' ? 'matchday' : 'pekan'} ${standingsRes.data.week}` : ''
                  }${updatedLabel ? ` · diperbarui otomatis ${updatedLabel}` : ''} · data ESPN`}
                  standings={standings}
                  loading={standingsRes.loading}
                  error={standingsRes.error}
                  zones={comp.zones}
                />
                <ScheduleCard
                  subtitle={`${comp.label} · 10 laga ke depan`}
                  upcoming={upcoming}
                  past={past}
                  loading={juveRes.loading}
                  error={juveRes.error}
                  standings={standings}
                />
              </div>
            ) : (
              <div className="kp-grid">
                <MatchesCard
                  title={`Pertandingan ${comp.label}`}
                  subtitle="Sistem gugur · data ESPN"
                  matches={competitionRes.data?.matches ?? []}
                  loading={competitionRes.loading}
                  error={competitionRes.error}
                  variant="all"
                />
                <ScheduleCard
                  subtitle={`${comp.label} · 10 laga ke depan`}
                  upcoming={upcoming}
                  past={past}
                  loading={juveRes.loading}
                  error={juveRes.error}
                  standings={standings}
                />
              </div>
            )
          )}

          {tab === 'lagalain' && (
            <MatchesCard
              title={`Laga lain di ${comp.label}`}
              subtitle="Tanpa Juventus"
              matches={competitionRes.data?.matches ?? []}
              loading={competitionRes.loading}
              error={competitionRes.error}
              variant="others"
            />
          )}

          {tab === 'topskor' && (
            <ScorersCard
              title={`Top skor ${comp.label}`}
              subtitle="Dihitung dari gol tiap pertandingan · data ESPN"
              players={competitionRes.data?.topScorers ?? []}
              loading={competitionRes.loading}
              error={competitionRes.error}
            />
          )}

          {!['klasemen', 'lagalain', 'topskor'].includes(tab) && (
            <div className="kp-card kp-empty">Bagian ini belum tersedia.</div>
          )}
        </>
      )}
    </div>
  );
}

export default function KompetisiPage() {
  return (
    <Suspense fallback={<div className="kp kp-empty">Memuat…</div>}>
      <KompetisiInner />
    </Suspense>
  );
}
