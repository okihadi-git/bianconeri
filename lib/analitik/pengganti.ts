// Analitik → Pemain pengganti: murni fungsi (tanpa fetch), jadi gampang diuji.
// Sumber: FotMob matchDetails → content.lineup (siapa masuk, menit) + content.matchFacts.events (gol/assist) + alur skor dari ./situasiskor.
import { parseMatchFlow } from './situasiskor';

export interface SubMatch {
  id: string;
  leagueId: string;
  leagueName: string;
  iso: string;
  coach: string;
  /** satu entri per pemain yang masuk dari bangku */
  subs: { id: string; name: string; on: number; goals: number; assists: number }[];
  /** poin akhir − poin kalau laga berakhir dengan skor saat pergantian pertama; null bila alur skor tidak ada */
  delta: number | null;
}

export interface SuperSub {
  id: string;
  name: string;
  apps: number;
  goals: number;
  assists: number;
}

export interface PenggantiResponse {
  totals: { subs: number; contributions: number; matches: number };
  /** rata-rata menit pergantian pertama; null bila tidak ada data */
  avgFirst: number | null;
  gained: number;
  lost: number;
  /** 10 kelompok: 0', 10', ... 90' */
  bins: number[];
  top: SuperSub[];
  coach: string;
  competitions: { id: string; name: string; matches: number }[];
  comp: string;
  warnings: string[];
  updatedAt: string;
}

export const BIN_TICKS = ["0'", "10'", "20'", "30'", "40'", "50'", "60'", "70'", "80'", "90'"];

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};
const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, '').trim();

function nameOf(n: any): string {
  const nm = n?.name;
  if (typeof nm === 'string') return nm;
  return String(nm?.fullName ?? ([nm?.firstName, nm?.lastName].filter(Boolean).join(' ') || n?.fullName || n?.shortName || '')).trim();
}

/** Menit masuk dari data pergantian FotMob; null = tidak masuk lapangan. */
function minuteOn(n: any): number | null {
  let on = num(n?.timeSubbedOn);
  const evs: any[] = Array.isArray(n?.performance?.substitutionEvents) ? n.performance.substitutionEvents : [];
  for (const e of evs) {
    const t = num(e?.time);
    if (t != null && /in|on/i.test(String(e?.type ?? ''))) on = on ?? t;
  }
  return on != null && on > 0 ? on : null;
}

/** Ringkas satu pertandingan FotMob → pergantian Juventus + kontribusi gol/assist pemain pengganti. Null bila lineup tidak ada. */
export function parseMatchSubs(data: any, teamId: string): SubMatch | null {
  const lineup = data?.content?.lineup;
  const juveHome = String(data?.general?.homeTeam?.id) === teamId;
  if (!juveHome && String(data?.general?.awayTeam?.id) !== teamId) return null;
  const side = lineup?.[juveHome ? 'homeTeam' : 'awayTeam'] ?? (Array.isArray(lineup) ? lineup[juveHome ? 0 : 1] : null);
  const bench: any[] = Array.isArray(side?.subs) ? side.subs : Array.isArray(side?.bench) ? side.bench : [];
  const starters: any[] = Array.isArray(side?.starters) ? side.starters : [];
  if (!bench.length && !starters.length) return null;

  const subs: SubMatch['subs'] = [];
  const byId = new Map<string, SubMatch['subs'][number]>();
  const byName = new Map<string, string>();
  for (const n of bench) {
    const on = minuteOn(n);
    const id = String(n?.id ?? n?.playerId ?? '');
    const name = nameOf(n);
    if (on == null || !id || !name) continue;
    const s = { id, name, on, goals: 0, assists: 0 };
    subs.push(s);
    byId.set(id, s);
    byName.set(normName(name), id);
  }

  const events: any[] = Array.isArray(data?.content?.matchFacts?.events?.events) ? data.content.matchFacts.events.events : [];
  for (const e of events) {
    if (!/^goal$/i.test(String(e?.type ?? '')) || e?.isPenaltyShootoutEvent || e?.shootoutEventType) continue;
    if (e?.ownGoal === true || /own/i.test(String(e?.eventType ?? e?.goalDescription ?? ''))) continue;
    const t = num(e?.time);
    if (t == null) continue;
    const scorer = byId.get(String(e?.player?.id ?? e?.playerId ?? ''));
    if (scorer && t >= scorer.on) scorer.goals += 1;
    const aid = String(e?.assistPlayerId ?? e?.assistPlayer?.id ?? (e?.assistStr ? byName.get(normName(String(e.assistStr))) ?? '' : ''));
    const asst = aid ? byId.get(aid) : undefined;
    if (asst && t >= asst.on) asst.assists += 1;
  }

  let delta: number | null = null;
  const flow = parseMatchFlow(data, teamId);
  if (flow && subs.length) {
    const first = Math.min(...subs.map((s) => s.on));
    const j = flow.goals.filter((g) => g.side === 'juve' && g.min <= first).length;
    const o = flow.goals.filter((g) => g.side === 'opp' && g.min <= first).length;
    delta = flow.pts - (j > o ? 3 : j === o ? 1 : 0);
  }

  return {
    id: String(data?.general?.matchId ?? ''),
    leagueId: String(data?.general?.leagueId ?? data?.general?.parentLeagueId ?? ''),
    leagueName: String(data?.general?.leagueName ?? data?.general?.parentLeagueName ?? 'Lainnya'),
    iso: String(data?.general?.matchTimeUTCDate ?? ''),
    coach: String(side?.coach?.name ?? '').trim(),
    subs,
    delta,
  };
}

/** Gabungkan semua laga → kartu ringkasan, sebaran menit pergantian, dan daftar super-sub. */
export function aggregate(matches: SubMatch[], topN = 10): Omit<PenggantiResponse, 'competitions' | 'comp' | 'warnings' | 'updatedAt'> {
  const bins = Array<number>(10).fill(0);
  const by = new Map<string, SuperSub>();
  let subsN = 0;
  let contributions = 0;
  let gained = 0;
  let lost = 0;
  const firsts: number[] = [];

  for (const m of matches) {
    if (!m.subs.length) continue;
    firsts.push(Math.min(...m.subs.map((s) => s.on)));
    if (m.delta != null) {
      if (m.delta > 0) gained += m.delta;
      else lost += -m.delta;
    }
    for (const s of m.subs) {
      subsN += 1;
      contributions += s.goals + s.assists;
      bins[Math.min(9, Math.floor(s.on / 10))] += 1;
      const p = by.get(s.id) ?? { id: s.id, name: s.name, apps: 0, goals: 0, assists: 0 };
      p.apps += 1;
      p.goals += s.goals;
      p.assists += s.assists;
      by.set(s.id, p);
    }
  }

  const top = [...by.values()]
    .sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.apps - a.apps || a.name.localeCompare(b.name))
    .slice(0, topN);

  // pelatih: dari laga terbaru yang melaporkannya
  const coach = [...matches].sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime()).find((m) => m.coach)?.coach ?? '';

  return {
    totals: { subs: subsN, contributions, matches: firsts.length },
    avgFirst: firsts.length ? Math.round(firsts.reduce((a, b) => a + b, 0) / firsts.length) : null,
    gained,
    lost,
    bins,
    top,
    coach,
  };
}
