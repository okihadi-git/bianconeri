// Helper bersama untuk data ESPN (Serie A)
export const JUVE_ID = '111';
export const ESPN_BASE = 'https://site.api.espn.com/apis';

/** Seluruh pertandingan Serie A musim berjalan (1 Agu – 31 Jul), satu request. */
export async function fetchSeasonEvents(): Promise<any[]> {
  try {
    const now = new Date();
    const startYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const url = `${ESPN_BASE}/site/v2/sports/soccer/ita.1/scoreboard?dates=${startYear}0801-${startYear + 1}0731&limit=1000`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.events ?? [];
  } catch {
    return [];
  }
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

/** Hasil tiap tim (urut lama → baru) dari daftar event selesai. */
export function buildFormMap(events: any[]): Record<string, FormLetter[]> {
  const done = events
    .filter(isCompleted)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const map: Record<string, FormLetter[]> = {};
  for (const ev of done) {
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
