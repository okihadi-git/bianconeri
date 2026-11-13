// Analisa → Penonton. Hanya ESPN (loadJuve = semua laga Juventus sejak awal musim); tidak butuh FotMob.
import { loadJuve } from './juve';
import { buildCrowd, type PenontonResponse } from './penonton';

export async function fetchPenonton(): Promise<PenontonResponse> {
  const { juveEvents } = await loadJuve();
  return buildCrowd(juveEvents);
}
