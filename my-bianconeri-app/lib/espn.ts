// Helper bersama untuk data ESPN (Serie A)
export const JUVE_ID = '111';
export const ESPN_BASE = 'https://site.api.espn.com/apis';

/** Jendela data: awal musim berjalan (1 Agu) sampai 31 Des. Jadwal ditampilkan hanya sampai sini. */
export function seasonWindow() {
  const now = new Date();
  const startYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return {
    startYear,
    start: `${startYear}0801`,
    end: `${startYear}1231`,
    endDate: new Date(`${startYear}-12-31T23:59:59+07:00`),
  };
}

async function getScoreboard(range: string): Promise<any[]> {
  try {
    const url = `${ESPN_BASE}/site/v2/sports/soccer/ita.1/scoreboard?dates=${range}&limit=1000`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.events ?? [];
  } catch {
    return [];
  }
}

/**
 * Semua pertandingan Serie A dari 1 Agu sampai 31 Des musim berjalan.
 * Coba satu request panjang; kalau kosong, ambil per bulan.
 */
export async function fetchSeasonEvents(): Promise<any[]> {
  const w = seasonWindow();
  let events = await getScoreboard(`${w.start}-${w.end}`);

  if (!events.length) {
    const y = w.startYear;
    const months: [string, string][] = [
      [`${y}0801`, `${y}0831`],
      [`${y}0901`, `${y}0930`],
      [`${y}1001`, `${y}1031`],
      [`${y}1101`, `${y}1130`],
      [`${y}1201`, `${y}1231`],
    ];
    const parts = await Promise.all(months.map(([a, b]) => getScoreboard(`${a}-${b}`)));
    events = parts.flat();
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
