// Helper data ESPN (endpoint publik, tanpa API key).
// Endpoint ini tidak resmi dan format/responsnya dapat berubah sewaktu-waktu.
import type { PlayerStat } from './types';

export const JUVE_ID = '111';
export const ESPN_BASE = 'https://site.api.espn.com/apis';

/** Kompetisi yang diikuti Juventus. `slug` = kode liga di ESPN. */
export const COMPETITIONS = [
  { slug: 'ita.1', name: 'Serie A' },
  { slug: 'uefa.europa', name: 'Liga Europa' },
  { slug: 'uefa.champions', name: 'Liga Champions' },
  { slug: 'ita.coppa_italia', name: 'Coppa Italia' },
  { slug: 'ita.super_cup', name: 'Supercoppa Italiana' },
] as const;

export const competitionName = (slug: string) =>
  COMPETITIONS.find((competition) => competition.slug === slug)?.name ?? slug;

const ymd = (date: Date) =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;

/** Awal musim sepak bola Eropa: 1 Agustus musim berjalan. */
export function seasonStart(): Date {
  const now = new Date();
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 7, 1));
}

export const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 86400000);

async function getScoreboard(slug: string, range: string): Promise<any[]> {
  const url = `${ESPN_BASE}/site/v2/sports/soccer/${slug}/scoreboard?dates=${range}&limit=1000`;

  try {
    const response = await fetch(url, { next: { revalidate: 1800 } });
    if (!response.ok) {
      console.warn(`[ESPN scoreboard] ${slug} ${range}: HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data?.events ?? []).map((event: any) => ({
      ...event,
      _league: slug,
    }));
  } catch (error) {
    console.warn(`[ESPN scoreboard] ${slug} ${range} gagal diambil`, error);
    return [];
  }
}

/**
 * Ambil semua pertandingan dalam rentang tanggal dengan potongan bulanan.
 *
 * ESPN kadang tidak mengembalikan seluruh pertandingan saat rentang tanggal
 * sangat panjang. Sebelumnya, jika rentang panjang menghasilkan beberapa event
 * saja, kode tidak melakukan fallback sehingga sebagian besar hasil musim
 * hilang dan form tiap tim menjadi [].
 */
export async function fetchLeagueEvents(
  slug: string,
  from: Date,
  to: Date
): Promise<any[]> {
  if (from > to) return [];

  const chunks: Array<{ from: Date; to: Date }> = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));

  while (cursor <= to) {
    const monthStart = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)
    );
    const nextMonth = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
    );
    const monthEnd = new Date(nextMonth.getTime() - 86400000);

    const chunkFrom = monthStart < from ? from : monthStart;
    const chunkTo = monthEnd > to ? to : monthEnd;

    if (chunkFrom <= chunkTo) chunks.push({ from: chunkFrom, to: chunkTo });
    cursor = nextMonth;
  }

  // Small bounded requests are more reliable than a single season-long range.
  const batches = await Promise.all(
    chunks.map(({ from: chunkFrom, to: chunkTo }) =>
      getScoreboard(slug, `${ymd(chunkFrom)}-${ymd(chunkTo)}`)
    )
  );

  const fromTime = from.getTime();
  const toTime = to.getTime();
  const unique = new Map<string, any>();

  for (const event of batches.flat()) {
    const id = String(event?.id ?? '');
    const time = new Date(event?.date).getTime();
    if (!id || !Number.isFinite(time) || time < fromTime || time > toTime) continue;
    if (!unique.has(id)) unique.set(id, event);
  }

  return [...unique.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export function isCompleted(event: any): boolean {
  const status = event?.competitions?.[0]?.status ?? event?.status;
  return Boolean(status?.type?.completed) || status?.type?.state === 'post';
}

/** Skor ESPN bisa berupa angka, string, atau objek {value, displayValue}. */
export function toNum(score: any): number {
  if (score && typeof score === 'object') {
    return Number(score.value ?? score.displayValue ?? 0);
  }
  return Number(score ?? 0);
}

export type FormLetter = 'W' | 'D' | 'L';

const byDate = (a: any, b: any) =>
  new Date(a.date).getTime() - new Date(b.date).getTime();

/** Hasil setiap tim, diurutkan dari pertandingan paling lama ke terbaru. */
export function buildFormMap(events: any[]): Record<string, FormLetter[]> {
  const map: Record<string, FormLetter[]> = {};

  for (const event of [...events].filter(isCompleted).sort(byDate)) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    if (competitors.length !== 2) continue;

    const [home, away] = competitors;
    const homeId = String(home?.team?.id ?? '');
    const awayId = String(away?.team?.id ?? '');
    if (!homeId || !awayId) continue;

    const homeScore = toNum(home.score);
    const awayScore = toNum(away.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

    const pushResult = (teamId: string, scored: number, conceded: number) => {
      (map[teamId] ||= []).push(
        scored > conceded ? 'W' : scored === conceded ? 'D' : 'L'
      );
    };

    pushResult(homeId, homeScore, awayScore);
    pushResult(awayId, awayScore, homeScore);
  }

  return map;
}

/**
 * Rekor liga tiap tim setelah pertandingan tertentu, mis. "4-2-2, 14 PTS".
 * Hanya untuk satu liga.
 */
export function buildRecords(events: any[]): Record<string, Record<string, string>> {
  const table: Record<string, { w: number; d: number; l: number }> = {};
  const output: Record<string, Record<string, string>> = {};

  for (const event of [...events].filter(isCompleted).sort(byDate)) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    if (competitors.length !== 2) continue;

    const [home, away] = competitors;
    const homeId = String(home?.team?.id ?? '');
    const awayId = String(away?.team?.id ?? '');
    if (!homeId || !awayId) continue;

    const homeScore = toNum(home.score);
    const awayScore = toNum(away.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

    const update = (teamId: string, scored: number, conceded: number) => {
      const record = (table[teamId] ||= { w: 0, d: 0, l: 0 });
      if (scored > conceded) record.w++;
      else if (scored === conceded) record.d++;
      else record.l++;
    };

    update(homeId, homeScore, awayScore);
    update(awayId, awayScore, homeScore);

    output[String(event.id)] = {};
    for (const competitor of [home, away]) {
      const teamId = String(competitor.team.id);
      const record = table[teamId];
      output[String(event.id)][teamId] =
        `${record.w}-${record.d}-${record.l}, ${record.w * 3 + record.d} PTS`;
    }
  }

  return output;
}

/** Agregasi gol & kartu per pemain dari `details` tiap pertandingan. Bisa dibatasi ke satu tim. */
export function aggregatePlayers(events: any[], teamId?: string): PlayerStat[] {
  const names: Record<string, string> = {};
  const players: Record<string, PlayerStat> = {};

  for (const event of events) {
    const competition = event.competitions?.[0];
    for (const competitor of competition?.competitors ?? []) {
      names[String(competitor.team?.id)] = competitor.team?.displayName ?? '';
    }

    for (const detail of competition?.details ?? []) {
      const currentTeamId = String(detail.team?.id ?? '');
      if (teamId && currentTeamId !== teamId) continue;
      const athlete = detail.athletesInvolved?.[0];
      if (!athlete) continue;

      const isGoal = Boolean(detail.scoringPlay) && !detail.ownGoal;
      const isYellow = Boolean(detail.yellowCard);
      const isRed =
        Boolean(detail.redCard) || /red card/i.test(detail.type?.text ?? '');
      if (!isGoal && !isYellow && !isRed) continue;

      const key = `${athlete.id ?? athlete.displayName}-${currentTeamId}`;
      const player = (players[key] ||= {
        id: String(athlete.id ?? key),
        name: athlete.displayName || athlete.shortName || '',
        teamId: currentTeamId,
        team: names[currentTeamId] || '',
        goals: 0,
        pens: 0,
        yellow: 0,
        red: 0,
      });

      if (isGoal) {
        player.goals++;
        if (detail.penaltyKick) player.pens++;
      }
      if (isYellow) player.yellow++;
      if (isRed) player.red++;
    }
  }

  return Object.values(players).sort(
    (a, b) =>
      b.goals - a.goals ||
      a.red - b.red ||
      a.yellow - b.yellow ||
      a.name.localeCompare(b.name)
  );
}
