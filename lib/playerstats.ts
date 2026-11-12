// Statistik pemain Juventus per kompetisi: dihitung dari ringkasan (summary) tiap laga yang sudah selesai di ESPN.
// ESPN tidak menyediakan rating pemain maupun xG. Rating di sini adalah ESTIMASI dari lib/ratings.ts (statistik ESPN, skala 6,0 = rata-rata).
import { JUVE_ID, isCompleted } from './espn';
import { buildLiveMatch, fetchSummary } from './live';
import { buildRatings, type RatedPlayer } from './ratings';
import type { LineupPlayer } from './types';

export type PosGroup = 'Kiper' | 'Bek' | 'Gelandang' | 'Penyerang';

/** Angka satu pemain di satu kompetisi. Field `null` = ESPN tidak melaporkannya sama sekali. */
export interface StatLine {
  played: number;
  started: number;
  minutes: number;
  goals: number;
  yellow: number;
  red: number;
  assists: number | null;
  shots: number | null;
  onTarget: number | null;
}

/** Rating (estimasi) satu pemain di satu laga yang ia mainkan. */
export interface MatchRating {
  matchId: string;
  league: string;
  iso: string;
  opp: string;
  rating: number | null;
  minutes: number;
  goals: number;
  assists: number;
  /** rating tertinggi di antara pemain Juventus pada laga itu */
  best: boolean;
}

export interface PlayerRow {
  id: string;
  name: string;
  group: PosGroup;
  /** singkatan posisi ESPN, mis. "LM", "AM-R" */
  pos: string;
  /** foto FotMob; kosong = inisial */
  photo?: string;
  /** slug kompetisi -> angka */
  by: Record<string, StatLine>;
  /** rating per laga (estimasi), urut menurut tanggal */
  ratings?: MatchRating[];
}

/** Angka tim per kompetisi. */
export interface TeamLine {
  matches: number;
  gf: number;
  ga: number;
  cleanSheets: number;
}

export interface PlayerStatsResponse {
  /** jumlah laga selesai per kompetisi */
  matches: Record<string, number>;
  /** gol, kebobolan, dan clean sheet Juventus per kompetisi */
  team?: Record<string, TeamLine>;
  players: PlayerRow[];
  updatedAt: string;
}

const emptyLine = (): StatLine => ({
  played: 0,
  started: 0,
  minutes: 0,
  goals: 0,
  yellow: 0,
  red: 0,
  assists: null,
  shots: null,
  onTarget: null,
});

const addNullable = (a: number | null, b: number | null) => (b == null ? a : (a ?? 0) + b);

/** "67'" -> 67, "90+3'" -> 90, kosong -> null */
function minuteOf(raw: string): number | null {
  const m = /^(\d+)/.exec(String(raw ?? '').trim());
  return m ? Number(m[1]) : null;
}

function groupOf(abbr: string): PosGroup {
  const a = abbr.toUpperCase();
  if (/^G/.test(a)) return 'Kiper';
  if (/^(CD|CB|LB|RB|D|SW|WB|LWB|RWB)/.test(a)) return 'Bek';
  if (/^(DM|CM|AM|LM|RM|M|CDM|CAM)/.test(a)) return 'Gelandang';
  return 'Penyerang';
}

const statOf = (entry: any, name: string): number | null => {
  const s = (entry?.stats ?? []).find((x: any) => x?.name === name);
  if (!s) return null;
  const v = Number(s.value);
  return Number.isFinite(v) ? v : null;
};

export async function buildPlayerStats(
  events: any[],
  load: (league: string, id: string, live: boolean) => Promise<any | null> = fetchSummary
): Promise<PlayerStatsResponse> {
  const done = events.filter(isCompleted);
  const matches: Record<string, number> = {};
  const team: Record<string, TeamLine> = {};
  const people = new Map<string, { name: string; votes: Record<string, number>; by: Record<string, StatLine>; ratings: MatchRating[] }>();

  const summaries: { event: any; summary: any }[] = [];
  for (let i = 0; i < done.length; i += 8) {
    const batch = done.slice(i, i + 8);
    const res = await Promise.all(batch.map((e) => load(e._league, String(e.id), false)));
    batch.forEach((event, k) => res[k] && summaries.push({ event, summary: res[k] }));
  }

  for (const { event, summary } of summaries) {
    const league = String(event._league);
    const live = buildLiveMatch(event, summary);
    const lineup = [live.lineups.home, live.lineups.away].find((l) => l?.teamId === JUVE_ID);
    if (!lineup) continue;
    matches[league] = (matches[league] ?? 0) + 1;

    const juveSide = live.home.isJuve ? live.home : live.away;
    const oppSide = juveSide === live.home ? live.away : live.home;
    const t = (team[league] ??= { matches: 0, gf: 0, ga: 0, cleanSheets: 0 });
    t.matches += 1;
    t.gf += juveSide.score;
    t.ga += oppSide.score;
    if (oppSide.score === 0) t.cleanSheets += 1;

    // rating estimasi tiap pemain Juventus di laga ini; kegagalan tidak boleh merusak statistik lainnya
    const ratedById = new Map<string, RatedPlayer>();
    let bestId = '';
    try {
      const rated = buildRatings(summary, live, null, []);
      const side = rated.home.isJuve ? rated.home : rated.away;
      for (const rp of [...side.rows.flat(), ...side.subs]) ratedById.set(rp.id, rp);
      let top = -1;
      for (const rp of ratedById.values()) if (rp.rating !== null && rp.rating > top) (top = rp.rating), (bestId = rp.id);
    } catch {
      /* tanpa rating untuk laga ini */
    }

    // Laga yang lanjut ke perpanjangan waktu: ada menit di atas 95 (selain tambahan waktu "90+x")
    const maxMinute = Math.max(0, ...live.timeline.filter((t) => t.kind !== 'period').map((t) => minuteOf(t.minute) ?? 0));
    const length = maxMinute > 95 || live.shootout ? 120 : 90;

    const rawRoster: any[] = (summary.rosters ?? []).find((r: any) => String(r?.team?.id) === JUVE_ID)?.roster ?? [];
    const raw = new Map(rawRoster.map((p) => [String(p?.athlete?.id ?? p?.id ?? ''), p]));

    const consider = (p: LineupPlayer, started: boolean) => {
      const on = started ? 0 : minuteOf(p.subOn);
      if (on == null) return; // cadangan yang tidak turun
      const off = minuteOf(p.subOff) ?? length;

      const entry = raw.get(p.id);
      const person = people.get(p.id) ?? { name: p.name, votes: {}, by: {}, ratings: [] };
      people.set(p.id, person);
      const line = (person.by[league] ??= emptyLine());

      line.played += 1;
      line.started += started ? 1 : 0;
      line.minutes += Math.max(0, off - on);
      line.goals += p.goals;
      line.yellow += p.yellow;
      line.red += p.red;
      line.assists = addNullable(line.assists, statOf(entry, 'goalAssists'));
      line.shots = addNullable(line.shots, statOf(entry, 'totalShots'));
      line.onTarget = addNullable(line.onTarget, statOf(entry, 'shotsOnTarget'));

      const rp = ratedById.get(p.id);
      if (rp && rp.rating !== null) {
        person.ratings.push({
          matchId: String(event.id),
          league,
          iso: String(live.iso ?? event.date ?? ''),
          opp: oppSide.name,
          rating: rp.rating,
          minutes: Math.max(0, off - on),
          goals: rp.goals,
          assists: rp.assists,
          best: p.id === bestId,
        });
      }

      for (const abbr of [entry?.position?.abbreviation, entry?.athlete?.position?.abbreviation, p.position]) {
        const a = String(abbr ?? '').trim();
        if (a && a.toUpperCase() !== 'SUB') {
          person.votes[a] = (person.votes[a] ?? 0) + 1;
          break;
        }
      }
    };
    lineup.starters.forEach((p) => consider(p, true));
    lineup.subs.forEach((p) => consider(p, false));
  }

  const players: PlayerRow[] = [...people.entries()].map(([id, p]) => {
    const pos = Object.entries(p.votes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    return { id, name: p.name, group: groupOf(pos), pos, by: p.by, ratings: p.ratings.sort((a, b) => a.iso.localeCompare(b.iso)) };
  });

  return { matches, team, players, updatedAt: new Date().toISOString() };
}
