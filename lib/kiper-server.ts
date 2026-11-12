// Analisa → Kiper. ESPN (menit, penyelamatan, kebobolan) + xG lawan dari FotMob (opsional; gagal = kolom xG kosong).
import { isCompleted } from './espn';
import { loadJuve } from './juve';
import { buildKiper, type KiperResponse } from './kiper';
import { xgByMatch } from './pola-server';

export async function fetchKiper(): Promise<KiperResponse> {
  const { juveEvents } = await loadJuve();
  const games = juveEvents.filter(isCompleted).map((e: any) => ({ id: String(e.id), iso: new Date(e.date).toISOString() }));
  const { xg } = await xgByMatch(games).catch(() => ({ xg: new Map<string, { f: number; a: number }>(), tried: 0 }));
  return buildKiper(juveEvents, xg);
}
