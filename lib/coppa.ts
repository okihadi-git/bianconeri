import type { Match } from '@/lib/types';

/**
 * Data tetap Coppa Italia. ESPN tidak menyediakan jumlah gelar maupun jadwal final jauh hari,
 * jadi dua nilai ini perlu diperbarui manual sekali setahun.
 */
export const COPPA_TITLES = { count: 15, lastSeason: '2023/24' };
export const COPPA_FINAL = { dateLabel: '20 MEI 2027', venue: 'Stadio Olimpico · Roma' };

export type Stage = 'r64' | 'r32' | 'r16' | 'qf' | 'sf' | 'f' | '';

export const STAGE_LABEL: Record<Exclude<Stage, ''>, string> = {
  r64: 'Round of 64',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Perempat final',
  sf: 'Semifinal',
  f: 'Final',
};

const LADDER: Stage[] = ['r64', 'r32', 'r16', 'qf', 'sf', 'f'];
// Dipakai kalau ESPN tidak mengirim nama babak: Juventus masuk di Round of 16, semifinal 2 leg.
const FALLBACK: Stage[] = ['r16', 'qf', 'sf', 'sf', 'f'];

export function stageOf(round: string): Stage {
  const r = round.toLowerCase();
  if (!r) return '';
  if (/semi/.test(r)) return 'sf';
  if (/quarter/.test(r)) return 'qf';
  if (/round of 16|last 16/.test(r)) return 'r16';
  if (/round of 32/.test(r)) return 'r32';
  if (/round of 64/.test(r)) return 'r64';
  if (/final/.test(r)) return 'f';
  return '';
}

export interface CoppaStatus {
  stage: Stage;
  eliminated: boolean;
  champion: boolean;
  last?: Match;
  lastStage: Stage;
  next?: Match;
  /** Agregat dua leg semifinal, kalau keduanya sudah dimainkan. */
  aggregate: { juve: number; opp: number } | null;
}

/** `past` urut terbaru di atas (seperti dari /api/juventus), `upcoming` urut terdekat di atas. */
export function coppaStatus(past: Match[], upcoming: Match[]): CoppaStatus {
  const chron = [...past].reverse();
  const all = [...chron, ...upcoming];
  const stages = all.map((m, i) => stageOf(m.round) || FALLBACK[Math.min(i, FALLBACK.length - 1)]);

  const last = past[0];
  const next = upcoming[0];
  const lastStage: Stage = last ? stages[chron.length - 1] : '';
  const nextStage: Stage = next ? stages[chron.length] : '';

  let aggregate: CoppaStatus['aggregate'] = null;
  let eliminated = false;
  if (last) {
    if (lastStage === 'sf') {
      const sfLegs = chron.filter((_, i) => stages[i] === 'sf');
      if (sfLegs.length >= 2) {
        const legs = sfLegs.slice(-2);
        aggregate = {
          juve: legs.reduce((n, m) => n + m.juveScore, 0),
          opp: legs.reduce((n, m) => n + m.opponentScore, 0),
        };
        eliminated = aggregate.juve < aggregate.opp || (aggregate.juve === aggregate.opp && last.winner === false);
      }
    } else {
      eliminated = last.winner === false || (last.winner == null && last.result === 'L');
    }
  }

  const champion = Boolean(last) && lastStage === 'f' && (last.winner === true || (last.winner == null && last.result === 'W'));

  let stage: Stage = '';
  if (champion) stage = 'f';
  else if (eliminated) stage = lastStage;
  else if (next) stage = nextStage;
  else if (last) {
    const i = LADDER.indexOf(lastStage);
    // semifinal baru satu leg dimainkan -> tetap semifinal; selain itu naik satu babak
    stage = lastStage === 'sf' && !aggregate ? 'sf' : LADDER[Math.min(i + 1, LADDER.length - 1)];
  }

  return { stage, eliminated, champion, last, lastStage, next, aggregate };
}

/** "2026/27" dari tanggal final: musim berganti sekitar Juli. */
export function seasonOf(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const start = d.getUTCMonth() >= 6 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}
