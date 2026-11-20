// Analisa → Pola laga: tipe dan konversi menit gol (murni, aman dipakai di browser).
import type { MatchEvent } from '../core/types';
import { minuteOf } from './util';

export interface PolaGoal {
  /** menit dasar (45+2 → 45) */
  min: number;
  /** true = gol Juventus (termasuk gol bunuh diri lawan) */
  mine: boolean;
}

export interface PolaGame {
  id: string;
  league: string;
  competition: string;
  iso: string;
  home: boolean;
  oppId: string;
  gf: number;
  ga: number;
  goals: PolaGoal[];
  /** true bila menit gol cocok dengan skor akhir; false = timeline tidak bisa dipercaya */
  timeline: boolean;
  xgFor: number | null;
  xgAgainst: number | null;
}

export interface PolaResponse {
  /** urut dari laga paling awal */
  games: PolaGame[];
  /** peringkat Serie A tiap tim (kunci: id ESPN) */
  positions: Record<string, number>;
  warnings: string[];
  updatedAt: string;
}

/**
 * Gol dari kejadian laga ESPN. Gol bunuh diri dicocokkan dengan skor akhir supaya sisi yang diuntungkan benar
 * (ESPN tidak konsisten menandai sisinya). `timeline` = jumlah gol per sisi sama dengan skor akhir.
 */
export function toGoals(events: MatchEvent[], gf: number, ga: number): { goals: PolaGoal[]; timeline: boolean } {
  const goals: PolaGoal[] = [];
  const own: MatchEvent[] = [];
  for (const e of events) {
    if (e.kind !== 'goal') continue;
    if (e.tag === 'og') own.push(e);
    else goals.push({ min: minuteOf(e.minute) ?? 0, mine: e.side === 'juve' });
  }
  let needMine = gf - goals.filter((g) => g.mine).length;
  let needOpp = ga - goals.filter((g) => !g.mine).length;
  for (const e of own) {
    let mine: boolean;
    if (needMine > 0 && needOpp <= 0) mine = true;
    else if (needOpp > 0 && needMine <= 0) mine = false;
    else mine = e.side !== 'juve';
    if (mine) needMine -= 1;
    else needOpp -= 1;
    goals.push({ min: minuteOf(e.minute) ?? 0, mine });
  }
  goals.sort((a, b) => a.min - b.min);
  return { goals, timeline: goals.filter((g) => g.mine).length === gf && goals.filter((g) => !g.mine).length === ga };
}
