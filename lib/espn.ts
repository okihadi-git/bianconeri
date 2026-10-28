// Helper data ESPN (endpoint publik tidak resmi, tanpa API key)
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
  COMPETITIONS.find((c) => c.slug === slug)?.name ?? slug;

const ymd = (d: Date) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

/** 1 Agustus musim berjalan. */
export function seasonStart(): Date {
  const now = new Date();
  const y = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(y, 7, 1));
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

async function getScoreboard(slug: string, range: string): Promise<any[]> {
  try {
    const url = `${ESPN_BASE}/site/v2/sports/soccer/${slug}/scoreboard?dates=${range}&limit=1000`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.events ?? []).map((e: any) => ({ ...e, _league: slug }));
  } catch {
    return [];
  }
}

/** Semua pertandingan satu liga pada rentang tanggal. Kalau request panjang kosong, ambil per bulan. */
export async function fetchLeagueEvents(slug: string, from: Date, to: Date): Promise<any[]> {
  let events = await getScoreboard(slug, `${ymd(from)}-${ymd(to)}`);

  if (!events.length) {
    const chunks: Promise<any[]>[] = [];
    let cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    while (cur <= to) {
      const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
      chunks.push(getScoreboard(slug, `${ymd(cur < from ? from : cur)}-${ymd(next > to ? to : next)}`));
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }
    events = (await Promise.all(chunks)).flat();
  }

  const seen = new Set<string>();
  return events.filter((e) => {
    const id = String(e.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function isCompleted(event: any): boolean {
  const st = event?.competitions?.[0]?.status ?? event?.status;
  return Boolean(st?.type?.completed) || st?.type?.state === 'post';
}

/** Skor ESPN bisa berupa angka, string, atau objek {value, displayValue}. */
export function toNum(score: any): number {
  if (score && typeof score === 'object') return Number(score.value ?? score.displayValue ?? 0);
  return Number(score ?? 0);
}

export type FormLetter = 'W' | 'D' | 'L';

const byDate = (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime();

/** Hasil tiap tim (urut lama → baru). */
export function buildFormMap(events: any[]): Record<string, FormLetter[]> {
  const map: Record<string, FormLetter[]> = {};
  for (const ev of events.filter(isCompleted).sort(byDate)) {
    const comps = ev.competitions?.[0]?.competitors ?? [];
    if (comps.length !== 2) continue;
    const [a, b] = comps;
    const sa = toNum(a.score);
    const sb = toNum(b.score);
    const put = (id: string, mine: number, theirs: number) => {
      (map[id] ||= []).push(mine > theirs ? 'W' : mine === theirs ? 'D' : 'L');
    };
    put(String(a.team?.id), sa, sb);
    put(String(b.team?.id), sb, sa);
  }
  return map;
}

/**
 * Rekor liga tiap tim SETELAH pertandingan tertentu, mis. "4-2-2, 14 PTS"
 * (seperti header skor di ESPN). Hanya untuk satu liga.
 */
export function buildRecords(events: any[]): Record<string, Record<string, string>> {
  const table: Record<string, { w: number; d: number; l: number }> = {};
  const out: Record<string, Record<string, string>> = {};
  for (const ev of events.filter(isCompleted).sort(byDate)) {
    const comps = ev.competitions?.[0]?.competitors ?? [];
    if (comps.length !== 2) continue;
    const [a, b] = comps;
    const sa = toNum(a.score);
    const sb = toNum(b.score);
    const upd = (id: string, mine: number, theirs: number) => {
      const t = (table[id] ||= { w: 0, d: 0, l: 0 });
      if (mine > theirs) t.w++;
      else if (mine === theirs) t.d++;
      else t.l++;
    };
    upd(String(a.team?.id), sa, sb);
    upd(String(b.team?.id), sb, sa);
    out[String(ev.id)] = {};
    for (const c of [a, b]) {
      const t = table[String(c.team?.id)];
      out[String(ev.id)][String(c.team?.id)] = `${t.w}-${t.d}-${t.l}, ${t.w * 3 + t.d} PTS`;
    }
  }
  return out;
}

/** Agregasi gol & kartu per pemain dari `details` tiap pertandingan. Bisa dibatasi ke satu tim. */
export function aggregatePlayers(events: any[], teamId?: string): PlayerStat[] {
  const names: Record<string, string> = {};
  const players: Record<string, PlayerStat> = {};

  for (const ev of events) {
    const comp = ev.competitions?.[0];
    for (const c of comp?.competitors ?? []) names[String(c.team?.id)] = c.team?.displayName ?? '';
    for (const d of comp?.details ?? []) {
      const tid = String(d.team?.id ?? '');
      if (teamId && tid !== teamId) continue;
      const a = d.athletesInvolved?.[0];
      if (!a) continue;

      const isGoal = Boolean(d.scoringPlay) && !d.ownGoal;
      const isYellow = Boolean(d.yellowCard);
      const isRed = Boolean(d.redCard) || /red card/i.test(d.type?.text ?? '');
      if (!isGoal && !isYellow && !isRed) continue;

      const key = `${a.id ?? a.displayName}-${tid}`;
      const p = (players[key] ||= {
        id: String(a.id ?? key),
        name: a.displayName || a.shortName || '',
        teamId: tid,
        team: names[tid] || '',
        goals: 0,
        pens: 0,
        yellow: 0,
        red: 0,
      });
      if (isGoal) {
        p.goals++;
        if (d.penaltyKick) p.pens++;
      }
      if (isYellow) p.yellow++;
      if (isRed) p.red++;
    }
  }

  return Object.values(players).sort(
    (a, b) => b.goals - a.goals || a.red - b.red || a.yellow - b.yellow || a.name.localeCompare(b.name)
  );
}
