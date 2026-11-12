// Kesulitan jadwal: xPts untuk laga liga berikutnya tiap tim Serie A + laga kompetisi lain Juventus di sela-selanya.
import { JUVE_ID } from './espn';
import { HORIZON, buildTeams, type JTeam } from './jadwal';
import { loadJuve } from './juve';
import { loadSeason, type Season } from './peluang-server';
import type { Match } from './types';

export interface OtherFixture {
  id: string;
  iso: string;
  competition: string;
  opponent: string;
  isHome: boolean;
}

export interface JadwalResponse {
  league: string;
  horizon: number;
  juveId: string;
  teams: JTeam[];
  /** laga Juventus di kompetisi lain di antara laga liga pertama dan terakhir dalam daftar */
  others: OtherFixture[];
  warnings: string[];
  updatedAt: string;
}

/** Laga Juventus selain Serie A yang jatuh di antara laga liga pertama dan terakhir. */
export function othersBetween(upcoming: Pick<Match, 'id' | 'iso' | 'league' | 'competition' | 'opponent' | 'isHome'>[], team: JTeam | undefined): OtherFixture[] {
  const first = team?.fixtures[0];
  const lastF = team?.fixtures[team.fixtures.length - 1];
  if (!first || !lastF) return [];
  const from = new Date(first.iso).getTime();
  const to = new Date(lastF.iso).getTime();
  return upcoming
    .filter((m) => m.league !== 'ita.1' && new Date(m.iso).getTime() > from && new Date(m.iso).getTime() < to)
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .map((m) => ({ id: String(m.id), iso: m.iso, competition: m.competition, opponent: m.opponent, isHome: m.isHome }));
}

export function computeJadwal(season: Season, upcoming: Parameters<typeof othersBetween>[0], now: Date): JadwalResponse {
  const teams = buildTeams(season.rows, season.events, season.muHome, season.muAway, now);
  const juve = teams.find((t) => t.id === JUVE_ID);
  const warnings: string[] = [];
  if (!juve) warnings.push('Juventus tidak ditemukan di klasemen Serie A dari ESPN.');
  else if (!juve.fixtures.length) warnings.push('Belum ada laga Serie A berikutnya di jadwal ESPN.');
  else if (juve.fixtures.length < HORIZON) warnings.push(`Baru ${juve.fixtures.length} laga Serie A tersisa/terjadwal untuk Juventus.`);
  return { league: 'Serie A', horizon: HORIZON, juveId: JUVE_ID, teams, others: othersBetween(upcoming, juve), warnings, updatedAt: now.toISOString() };
}

export async function fetchJadwal(): Promise<JadwalResponse | null> {
  const [season, juve] = await Promise.all([loadSeason('ita.1').catch(() => null), loadJuve().catch(() => null)]);
  if (!season) return null;
  return computeJadwal(season, juve?.upcoming ?? [], new Date());
}
