// Hitungan murni untuk popup pemain (tanpa fetch, aman di klien): ringkasan statistik, persentil, kontrak, tren form.
import { findPlayer } from './names';
import type { PlayerRow, PlayerStatsResponse, StatLine } from './playerstats';

const LEAGUE = 'ita.1';

export interface Totals {
  played: number;
  started: number;
  minutes: number;
  goals: number;
  assists: number | null;
  shots: number | null;
  onTarget: number | null;
  yellow: number;
  red: number;
}

const addN = (a: number | null, b: number | null) => (b == null ? a : (a ?? 0) + b);

export function totalsOf(row: PlayerRow): Totals {
  const t: Totals = { played: 0, started: 0, minutes: 0, goals: 0, assists: null, shots: null, onTarget: null, yellow: 0, red: 0 };
  for (const l of Object.values(row.by) as StatLine[]) {
    t.played += l.played;
    t.started += l.started;
    t.minutes += l.minutes;
    t.goals += l.goals;
    t.yellow += l.yellow;
    t.red += l.red;
    t.assists = addN(t.assists, l.assists);
    t.shots = addN(t.shots, l.shots);
    t.onTarget = addN(t.onTarget, l.onTarget);
  }
  return t;
}

export interface Summary {
  row: PlayerRow;
  totals: Totals;
  /** starter di Serie A saja */
  leagueStarts: number;
  /** laga resmi yang sudah selesai (semua kompetisi) */
  matchesTotal: number;
}

export function summarize(name: string, stats: PlayerStatsResponse | null): Summary | null {
  if (!stats) return null;
  const row = findPlayer(name, stats.players);
  const matchesTotal = Object.values(stats.matches).reduce((n, v) => n + v, 0);
  if (!row) return { row: { id: '', name, group: 'Gelandang', pos: '', by: {} }, totals: totalsOf({ id: '', name, group: 'Gelandang', pos: '', by: {} }), leagueStarts: 0, matchesTotal };
  return { row, totals: totalsOf(row), leagueStarts: row.by[LEAGUE]?.started ?? 0, matchesTotal };
}

/* ---------- persentil ---------- */

export interface Axis {
  key: string;
  label: string;
  /** 0–100; null = ESPN tidak melaporkan angkanya */
  pct: number | null;
}

const MIN_MINUTES = 180;

/** Persentil: porsi rekan yang nilainya lebih rendah + setengah porsi yang sama. 100 = terbaik. */
export function percentile(value: number, peers: number[], lowerIsBetter = false): number {
  if (!peers.length) return 0;
  const better = peers.filter((v) => (lowerIsBetter ? v > value : v < value)).length;
  const same = peers.filter((v) => v === value).length;
  return Math.round(((better + same / 2) / peers.length) * 100);
}

const per90 = (n: number | null, minutes: number) => (n == null || minutes <= 0 ? null : (n / minutes) * 90);

export interface Profile {
  axes: Axis[];
  /** jumlah pemain pembanding (termasuk pemain ini) */
  peers: number;
  group: string;
}

/** Bandingkan dengan pemain sekelompok posisi yang sudah main minimal 180 menit. null bila pemain ini belum cukup menit. */
export function buildProfile(self: PlayerRow, stats: PlayerStatsResponse): Profile | null {
  const mine = totalsOf(self);
  if (mine.minutes < MIN_MINUTES) return null;

  const peers = stats.players
    .filter((p) => p.group === self.group)
    .map((p) => ({ id: p.id, t: totalsOf(p) }))
    .filter((p) => p.t.minutes >= MIN_MINUTES);

  // kartu: kuning = 1, merah = 3, per 90 menit; makin sedikit makin baik
  const cards = (t: Totals) => ((t.yellow + t.red * 3) / t.minutes) * 90;

  const metric = (key: string, label: string, pick: (t: Totals) => number | null, lowerIsBetter = false): Axis => {
    const v = pick(mine);
    if (v == null) return { key, label, pct: null };
    const pool = peers.map((p) => pick(p.t)).filter((x): x is number => x != null);
    return { key, label, pct: percentile(v, pool, lowerIsBetter) };
  };

  return {
    group: self.group,
    peers: peers.length,
    axes: [
      metric('goals', 'Gol/90', (t) => per90(t.goals, t.minutes)),
      metric('assists', 'Assist/90', (t) => per90(t.assists, t.minutes)),
      metric('shots', 'Tembakan/90', (t) => per90(t.shots, t.minutes)),
      metric('onTarget', 'Tepat sasaran/90', (t) => per90(t.onTarget, t.minutes)),
      metric('minutes', 'Menit bermain', (t) => t.minutes),
      metric('discipline', 'Disiplin', cards, true),
    ],
  };
}

/* ---------- kontrak ---------- */

/** Tahun berakhirnya musim yang memuat tanggal ini (Juli–Juni): 6 Nov 2026 → 2027. */
const seasonEndYear = (d: Date) => (d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear());

/** Sisa musim kontrak, termasuk musim berjalan: kontrak Juni 2030 dari November 2026 = 4 musim. 0 bila sudah habis/tak valid. */
export function seasonsLeft(contractIso: string | null, now: Date): number {
  if (!contractIso) return 0;
  const end = new Date(contractIso);
  if (Number.isNaN(end.getTime())) return 0;
  // 30 Jun 2030 → musim 2029/30 (berakhir 2030); 1 Jul 2030 → musim 2030/31
  const endSeason = end.getUTCMonth() >= 6 ? end.getUTCFullYear() + 1 : end.getUTCFullYear();
  return Math.max(0, endSeason - seasonEndYear(now) + 1);
}

/* ---------- form ---------- */

export function trend(ratings: number[]): 'naik' | 'turun' | 'stabil' | null {
  if (ratings.length < 6) return ratings.length ? 'stabil' : null;
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const diff = avg(ratings.slice(-3)) - avg(ratings.slice(0, -3));
  return diff > 0.3 ? 'naik' : diff < -0.3 ? 'turun' : 'stabil';
}

/* ---------- istilah ---------- */

const POSITIONS: Record<string, string> = {
  goalkeeper: 'Kiper',
  'centre-back': 'Bek tengah',
  'center back': 'Bek tengah',
  'left-back': 'Bek kiri',
  'right-back': 'Bek kanan',
  'defensive midfield': 'Gelandang bertahan',
  'central midfield': 'Gelandang tengah',
  'attacking midfield': 'Gelandang serang',
  'left midfield': 'Gelandang kiri',
  'right midfield': 'Gelandang kanan',
  'left winger': 'Sayap kiri',
  'right winger': 'Sayap kanan',
  'second striker': 'Penyerang kedua',
  'centre-forward': 'Striker',
  striker: 'Striker',
};

export const positionId = (p: string | null | undefined) => (p ? POSITIONS[p.trim().toLowerCase()] ?? p : '');

/** 24 Maret 2001 */
export function fmtDateId(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export function ageAt(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const b = new Date(iso);
  if (Number.isNaN(b.getTime())) return null;
  let a = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) a -= 1;
  return a;
}
