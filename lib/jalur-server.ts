// Poin juara dan peringkat 4 tiap musim lalu, dari klasemen akhir ESPN (?season=). Tidak melempar error: musim yang gagal dilewati.
import { ESPN_BASE } from './espn';
import type { HistorySeason } from './jalur';

const ALLOWED = ['ita.1'];

async function finalTable(league: string, year: number): Promise<{ name: string; points: number; rank: number }[] | null> {
  try {
    const res = await fetch(`${ESPN_BASE}/v2/sports/soccer/${league}/standings?season=${year}`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const entries: any[] = data?.children?.flatMap((g: any) => g?.standings?.entries ?? []) ?? data?.standings?.entries ?? [];
    const rows = entries
      .map((e) => {
        const stat = (n: string) => Number((e.stats ?? []).find((s: any) => s.name === n)?.value ?? 0);
        return { name: String(e.team?.displayName ?? e.team?.name ?? ''), points: stat('points'), rank: stat('rank'), played: stat('gamesPlayed') };
      })
      .filter((r) => r.name);
    // musim harus sudah selesai: tim liga penuh dan semua laga dimainkan
    if (rows.length < 16 || rows.some((r) => r.played < (rows.length - 1) * 2)) return null;
    return rows.sort((a, b) => (a.rank || 99) - (b.rank || 99) || b.points - a.points);
  } catch {
    return null;
  }
}

/** `count` musim terakhir yang sudah selesai, terbaru dulu. */
export async function fetchHistory(league: string, count = 10, now = new Date()): Promise<HistorySeason[]> {
  if (!ALLOWED.includes(league)) return [];
  const lastDone = now.getUTCMonth() >= 6 ? now.getUTCFullYear() - 1 : now.getUTCFullYear() - 2; // musim mulai Agustus, selesai Mei
  const years = Array.from({ length: count }, (_, i) => lastDone - i);
  const tables = await Promise.all(years.map((y) => finalTable(league, y)));
  const out: HistorySeason[] = [];
  years.forEach((y, i) => {
    const t = tables[i];
    if (!t) return;
    out.push({ season: `${y}/${String(y + 1).slice(2)}`, first: { name: t[0].name, points: t[0].points }, fourth: t[3] ? { name: t[3].name, points: t[3].points } : null });
  });
  return out;
}
