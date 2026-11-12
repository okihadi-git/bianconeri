// Analitik → Penyelesaian: murni fungsi (tanpa fetch), jadi gampang diuji.
// Sumber: FotMob matchDetails → content.shotmap.shots (koordinat, xG, hasil, jenis tembakan; data Opta).
// ESPN tidak punya koordinat tembakan maupun xG.

export type Outcome = 'goal' | 'saved' | 'miss' | 'blocked';

export interface Shot {
  /** koordinat sudah dinormalkan: gawang lawan di x = 105 (panjang) dan y 0..68 (lebar), satuan meter */
  x: number;
  y: number;
  xg: number;
  outcome: Outcome;
  head: boolean;
  penalty: boolean;
  inBox: boolean;
  min: number;
  situation: string;
  opp: string;
  /** posisi bola melewati gawang (sumbu y lapangan) bila FotMob melaporkan; untuk garis gol */
  goalY: number | null;
}

export interface RawShot extends Shot {
  playerId: string;
  playerName: string;
}

export interface MatchShots {
  id: string;
  leagueId: string;
  leagueName: string;
  shots: RawShot[];
}

export interface PlayerShooting {
  id: string;
  name: string;
  photo: string;
  shots: Shot[];
  goals: number;
  xg: number;
  /** gol − xG */
  diff: number;
  total: number;
  onTarget: number;
  /** 0..1 */
  onTargetPct: number;
  inBoxPct: number;
  xgPerShot: number;
  headers: number;
}

export interface PenyelesaianResponse {
  players: PlayerShooting[];
  minShots: number;
  matches: number;
  hasXg: boolean;
  competitions: { id: string; name: string; matches: number }[];
  comp: string;
  warnings: string[];
  updatedAt: string;
}

export const MIN_SHOTS = 2;
export const PITCH_L = 105;
export const PITCH_W = 68;

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Kotak penalti lawan: 16,5 m dari garis gawang, lebar 40,32 m di tengah. */
export const inPenaltyBox = (x: number, y: number) => x >= PITCH_L - 16.5 && y >= (PITCH_W - 40.32) / 2 && y <= (PITCH_W + 40.32) / 2;

function outcomeOf(s: any): Outcome {
  const t = String(s?.eventType ?? '');
  if (s?.isBlocked === true || /block/i.test(t)) return 'blocked';
  if (/^goal$/i.test(t)) return 'goal';
  if (s?.isOnTarget === true || /save/i.test(t)) return 'saved';
  return 'miss'; // Miss, Post, dan sejenisnya
}

/** Ringkas satu pertandingan FotMob → semua tembakan Juventus. Null bila peta tembakan tidak ada. */
export function parseMatchShots(data: any, teamId: string): MatchShots | null {
  const list: any[] = Array.isArray(data?.content?.shotmap?.shots) ? data.content.shotmap.shots : [];
  const mine = list.filter((s) => String(s?.teamId) === teamId && !s?.isOwnGoal && !/own/i.test(String(s?.eventType ?? '')));
  if (!mine.length) return null;

  const home = data?.general?.homeTeam;
  const away = data?.general?.awayTeam;
  const opp = String(String(home?.id) === teamId ? away?.name : home?.name ?? '').trim() || 'Lawan';

  // Beberapa data memakai arah serang yang sama untuk semua laga, sebagian memantulkan per tim.
  // Median x tembakan < 52,5 berarti gawang yang diserang ada di sisi x = 0, jadi putar 180°.
  const xs = mine.map((s) => num(s?.x)).filter((v): v is number => v != null).sort((a, b) => a - b);
  if (!xs.length) return null;
  const flip = xs[Math.floor(xs.length / 2)] < PITCH_L / 2;

  const shots: RawShot[] = [];
  for (const s of mine) {
    let x = num(s?.x);
    let y = num(s?.y);
    if (x == null || y == null) continue;
    let gy = num(s?.goalCrossedY);
    if (flip) {
      x = PITCH_L - x;
      y = PITCH_W - y;
      if (gy != null) gy = PITCH_W - gy;
    }
    const type = String(s?.shotType ?? '');
    const situation = String(s?.situation ?? '');
    shots.push({
      playerId: String(s?.playerId ?? ''),
      playerName: String(s?.playerName ?? '').trim(),
      x: Math.min(PITCH_L, Math.max(0, x)),
      y: Math.min(PITCH_W, Math.max(0, y)),
      xg: r3(num(s?.expectedGoals) ?? 0),
      outcome: outcomeOf(s),
      head: /head/i.test(type),
      penalty: /penalty/i.test(situation),
      inBox: inPenaltyBox(x, y),
      min: num(s?.min) ?? 0,
      situation,
      opp,
      goalY: gy,
    });
  }
  if (!shots.length) return null;

  return {
    id: String(data?.general?.matchId ?? ''),
    leagueId: String(data?.general?.leagueId ?? data?.general?.parentLeagueId ?? ''),
    leagueName: String(data?.general?.leagueName ?? data?.general?.parentLeagueName ?? 'Lainnya'),
    shots,
  };
}

/** Gabungkan semua laga → statistik penyelesaian per pemain (minimal `minShots` tembakan), urut xG terbesar. */
export function aggregate(matches: MatchShots[], opts: { photo: (id: string) => string; minShots?: number }): Pick<PenyelesaianResponse, 'players' | 'hasXg' | 'minShots'> {
  const minShots = opts.minShots ?? MIN_SHOTS;
  const by = new Map<string, { name: string; shots: Shot[] }>();
  for (const m of matches) {
    for (const { playerId, playerName, ...shot } of m.shots) {
      if (!playerId) continue;
      const e = by.get(playerId) ?? { name: playerName, shots: [] };
      if (playerName && !e.name) e.name = playerName;
      e.shots.push(shot);
      by.set(playerId, e);
    }
  }

  let hasXg = false;
  const players: PlayerShooting[] = [];
  for (const [id, { name, shots }] of by) {
    if (shots.length < minShots) continue;
    const total = shots.length;
    const goals = shots.filter((s) => s.outcome === 'goal').length;
    const xg = shots.reduce((n, s) => n + s.xg, 0);
    if (xg > 0) hasXg = true;
    const onTarget = shots.filter((s) => s.outcome === 'goal' || s.outcome === 'saved').length;
    players.push({
      id,
      name,
      photo: opts.photo(id),
      shots: shots.sort((a, b) => b.xg - a.xg),
      goals,
      xg: r2(xg),
      diff: r2(goals - xg),
      total,
      onTarget,
      onTargetPct: onTarget / total,
      inBoxPct: shots.filter((s) => s.inBox).length / total,
      xgPerShot: r2(xg / total),
      headers: shots.filter((s) => s.head).length,
    });
  }
  players.sort((a, b) => b.xg - a.xg || b.goals - a.goals || a.name.localeCompare(b.name));
  return { players, hasXg, minShots };
}
