// Analitik → Musim ini vs musim lalu. ESPN scoreboard Serie A kedua musim (sumber yang sama supaya sebanding).
import { JUVE_ID, addDays, fetchLeagueEvents, seasonStart } from './espn';
import { isJuveEvent } from './juve';
import { SEASON_GAMES, aggregate, parseGame, type MusimResponse, type SeasonGame } from './musim';

function games(events: any[]): SeasonGame[] {
  const seen = new Set<string>();
  const out: SeasonGame[] = [];
  for (const e of events) {
    if (!isJuveEvent(e) || seen.has(String(e.id))) continue;
    seen.add(String(e.id));
    const g = parseGame(e, JUVE_ID);
    if (g) out.push(g);
  }
  return out;
}

export async function fetchMusim(): Promise<MusimResponse> {
  const start = seasonStart();
  const y = start.getUTCFullYear();
  const [curEv, prevEv] = await Promise.all([
    fetchLeagueEvents('ita.1', start, addDays(new Date(), 1)).catch(() => [] as any[]),
    fetchLeagueEvents('ita.1', new Date(Date.UTC(y - 1, 7, 1)), new Date(Date.UTC(y, 6, 31))).catch(() => [] as any[]),
  ]);
  const cur = games(curEv);
  const prev = games(prevEv);
  const body = aggregate(cur, prev, y);

  const warnings: string[] = [];
  if (!cur.length) warnings.push('Belum ada laga Serie A yang selesai musim ini di data ESPN.');
  else if (!body.now) warnings.push(`Data Serie A musim lalu di ESPN hanya ${prev.length} laga (kurang dari ${cur.length}), jadi perbandingan tidak bisa dibuat.`);
  else if (prev.length < SEASON_GAMES) warnings.push(`Data musim lalu hanya ${prev.length} dari ${SEASON_GAMES} laga; bila ada laga yang hilang, urutan pekan bisa bergeser.`);
  return { ...body, warnings, updatedAt: new Date().toISOString() };
}
