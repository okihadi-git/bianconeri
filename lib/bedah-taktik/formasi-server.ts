// Formasi & XI Juventus: lineup ESPN tiap laga resmi yang sudah selesai musim ini.
import { isCompleted } from '../core/espn';
import { loadJuve } from '../core/juve';
import { buildLiveMatch, fetchSummary } from '../core/live';
import { buildFormasi, type FMatch, type FormasiResult } from './formasi';

export interface FormasiResponse extends FormasiResult {
  /** laga selesai musim ini (sebelum disaring yang lineup-nya lengkap) */
  completed: number;
  warnings: string[];
  updatedAt: string;
}

export async function fetchFormasi(): Promise<FormasiResponse> {
  const updatedAt = new Date().toISOString();
  const { juveEvents } = await loadJuve();
  const done = juveEvents.filter(isCompleted);
  const empty = (w: string): FormasiResponse => ({ ...buildFormasi([]), completed: done.length, warnings: [w], updatedAt });
  if (!done.length) return empty('Belum ada laga selesai musim ini di data ESPN.');

  const matches: FMatch[] = [];
  let loaded = 0;
  for (let i = 0; i < done.length; i += 8) {
    const batch = done.slice(i, i + 8);
    const sums = await Promise.all(batch.map((e) => fetchSummary(String(e._league), String(e.id), false)));
    batch.forEach((event, k) => {
      if (!sums[k]) return;
      loaded += 1;
      const live = buildLiveMatch(event, sums[k]);
      const side = live.home.isJuve ? 'home' : live.away.isJuve ? 'away' : null;
      const lineup = side ? live.lineups[side] : null;
      if (!lineup || !lineup.formation) return;
      matches.push({
        id: String(event.id),
        iso: new Date(event.date).toISOString(),
        formation: lineup.formation,
        starters: lineup.starters.map((p) => ({ id: p.id, name: p.name, position: p.position })),
      });
    });
  }

  const body = buildFormasi(matches);
  const warnings: string[] = [];
  if (!body.matches) warnings.push('ESPN tidak memberi formasi dan susunan pemain untuk laga-laga ini.');
  else if (body.matches < done.length) warnings.push(`Formasi tersedia untuk ${body.matches} dari ${done.length} laga selesai.`);
  if (loaded < done.length) warnings.push(`Detail ${done.length - loaded} laga belum bisa dimuat dari ESPN.`);
  return { ...body, completed: done.length, warnings, updatedAt };
}
