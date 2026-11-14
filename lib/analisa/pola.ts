// Statistik → Analisa → Pola laga: murni fungsi (tanpa fetch), jadi gampang diuji.
// Sumber menit gol & skor: ESPN (lib/juve.ts). xG per laga (opsional): FotMob. Level lawan: klasemen Serie A saat ini.
// Laga yang daftar golnya tidak cocok dengan skor akhir tidak ikut hitungan menit/situasi skor (tetap ikut tabel).

import { pointsOf, r2 } from './util';

export type Side = 'juve' | 'opp';

export interface PolaGoal {
  /** menit; tambahan waktu = pecahan kecil (45'+2' → 45.02) */
  min: number;
  side: Side;
}

export interface PolaGame {
  id: string;
  /** slug ESPN, mis. "ita.1" */
  league: string;
  competition: string;
  iso: string;
  home: boolean;
  oppId: string;
  gf: number;
  ga: number;
  goals: PolaGoal[];
  /** daftar gol cocok dengan skor akhir → boleh dipakai untuk menit gol dan situasi skor */
  timeline: boolean;
  xgFor: number | null;
  xgAgainst: number | null;
}

export interface PolaResponse {
  games: PolaGame[];
  /** posisi klasemen Serie A saat ini per id tim ESPN */
  positions: Record<string, number>;
  warnings: string[];
  updatedAt: string;
}

export interface Wdl {
  n: number;
  w: number;
  d: number;
  l: number;
}

export interface PolaRow extends Wdl {
  key: string;
  label: string;
  gf: number;
  ga: number;
  ppg: number | null;
  /** rata-rata xG / xGA per laga, hanya dari laga yang punya xG */
  xg: number | null;
  xga: number | null;
}

export interface PolaStats {
  n: number;
  /** laga yang daftar golnya bisa dipakai */
  nTimeline: number;
  bins: { label: string; gf: number; ga: number }[];
  h1: { gf: number; ga: number };
  h2: { gf: number; ga: number };
  late: { gf: number; ga: number };
  /** null bila tidak ada laga dengan daftar gol yang bisa dipakai */
  state: {
    scoredFirst: Wdl;
    concededFirst: Wdl;
    behindPts: number;
    comebacks: number;
    lostPts: number;
    leadHt: Wdl;
    levelHt: Wdl;
    trailHt: Wdl;
  } | null;
  cleanSheets: number;
  failedToScore: number;
  rows: PolaRow[];
}

const COMP_SHORT: Record<string, string> = {
  'ita.1': 'Serie A',
  'uefa.champions': 'UCL',
  'uefa.europa': 'UEL',
  'ita.coppa_italia': 'Coppa Italia',
  'ita.super_cup': 'Supercoppa',
};

/** "45'+2'" → 45.02 ; "67'" → 67 ; kosong → null */
export function parseMin(raw: string): number | null {
  const m = /(\d+)\s*'?\s*(?:\+\s*(\d+))?/.exec(String(raw ?? ''));
  return m ? Number(m[1]) + Number(m[2] ?? 0) * 0.01 : null;
}

/**
 * Daftar gol dari kejadian ESPN. `timeline` false bila ada gol tanpa menit atau jumlahnya tidak cocok dengan skor akhir.
 * Pada gol bunuh diri, tim yang tercatat di ESPN bisa tim pencetak atau tim yang diuntungkan: dicoba keduanya,
 * dan dipakai yang cocok dengan skor.
 */
export function toGoals(events: { kind: string; side: Side; minute: string; tag?: string }[], gf: number, ga: number): { goals: PolaGoal[]; timeline: boolean } {
  const raw = events.filter((e) => e.kind === 'goal').map((e) => ({ min: parseMin(e.minute), side: e.side, og: e.tag === 'og' }));
  if (raw.some((g) => g.min == null)) return { goals: [], timeline: false };
  const clean = (l: typeof raw): PolaGoal[] => l.map((g) => ({ min: g.min as number, side: g.side }));
  const ok = (l: PolaGoal[]) => l.filter((g) => g.side === 'juve').length === gf && l.filter((g) => g.side === 'opp').length === ga;
  const asIs = clean(raw);
  if (ok(asIs)) return { goals: asIs, timeline: true };
  if (raw.some((g) => g.og)) {
    const flipped = clean(raw.map((g) => (g.og ? { ...g, side: (g.side === 'juve' ? 'opp' : 'juve') as Side } : g)));
    if (ok(flipped)) return { goals: flipped, timeline: true };
  }
  return { goals: [], timeline: false };
}

export const compLabel = (slug: string, fallback = slug) => COMP_SHORT[slug] ?? fallback;

/** Pilihan filter kompetisi: hanya yang punya laga. */
export function compOptions(games: PolaGame[]): { key: string; label: string; n: number }[] {
  const by = new Map<string, { label: string; n: number }>();
  for (const g of games) {
    const c = by.get(g.league) ?? { label: compLabel(g.league, g.competition), n: 0 };
    c.n += 1;
    by.set(g.league, c);
  }
  const order = Object.keys(COMP_SHORT);
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : 99);
  const list = [...by.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || b[1].n - a[1].n).map(([key, v]) => ({ key, ...v }));
  return [{ key: 'all', label: 'Semua', n: games.length }, ...list];
}

const emptyWdl = (): Wdl => ({ n: 0, w: 0, d: 0, l: 0 });
const addRes = (t: Wdl, g: PolaGame) => {
  t.n += 1;
  if (g.gf > g.ga) t.w += 1;
  else if (g.gf === g.ga) t.d += 1;
  else t.l += 1;
};
const pts = (g: PolaGame) => pointsOf(g.gf, g.ga);

function rowOf(key: string, label: string, list: PolaGame[]): PolaRow {
  const t = emptyWdl();
  list.forEach((g) => addRes(t, g));
  const gf = list.reduce((n, g) => n + g.gf, 0);
  const ga = list.reduce((n, g) => n + g.ga, 0);
  const withXg = list.filter((g) => g.xgFor != null && g.xgAgainst != null);
  return {
    key,
    label,
    ...t,
    gf,
    ga,
    ppg: list.length ? r2(list.reduce((n, g) => n + pts(g), 0) / list.length) : null,
    xg: withXg.length ? r2(withXg.reduce((n, g) => n + (g.xgFor as number), 0) / withXg.length) : null,
    xga: withXg.length ? r2(withXg.reduce((n, g) => n + (g.xgAgainst as number), 0) / withXg.length) : null,
  };
}

export const BIN_LABELS = ['1–15', '16–30', '31–45+', '46–60', '61–75', '76–90+'];

export function buildPola(all: PolaGame[], positions: Record<string, number>, comp = 'all'): PolaStats {
  const games = comp === 'all' ? all : all.filter((g) => g.league === comp);
  const tl = games.filter((g) => g.timeline);

  const bins = BIN_LABELS.map((label) => ({ label, gf: 0, ga: 0 }));
  for (const g of tl) {
    for (const goal of g.goals) {
      const base = Math.floor(goal.min + 1e-6);
      if (base < 1 || base > 90) continue; // perpanjangan waktu tidak ikut peta waktu
      bins[Math.min(5, Math.floor((base - 1) / 15))][goal.side === 'juve' ? 'gf' : 'ga'] += 1;
    }
  }
  const sumBins = (from: number, to: number) => ({ gf: bins.slice(from, to).reduce((n, b) => n + b.gf, 0), ga: bins.slice(from, to).reduce((n, b) => n + b.ga, 0) });

  let state: PolaStats['state'] = null;
  if (tl.length) {
    const s = { scoredFirst: emptyWdl(), concededFirst: emptyWdl(), behindPts: 0, comebacks: 0, lostPts: 0, leadHt: emptyWdl(), levelHt: emptyWdl(), trailHt: emptyWdl() };
    for (const g of tl) {
      const sorted = [...g.goals].sort((a, b) => a.min - b.min);
      const first = sorted[0];
      if (first) addRes(first.side === 'juve' ? s.scoredFirst : s.concededFirst, g);
      let d = 0;
      let led = false;
      let trailed = false;
      let ht = 0;
      for (const goal of sorted) {
        d += goal.side === 'juve' ? 1 : -1;
        if (d > 0) led = true;
        if (d < 0) trailed = true;
        if (Math.floor(goal.min + 1e-6) <= 45) ht = d;
      }
      if (trailed) {
        s.behindPts += pts(g);
        if (g.gf >= g.ga) s.comebacks += 1;
      }
      if (led && g.gf <= g.ga) s.lostPts += 3 - pts(g);
      addRes(ht > 0 ? s.leadHt : ht < 0 ? s.trailHt : s.levelHt, g);
    }
    state = s;
  }

  const league = games.filter((g) => g.league === 'ita.1' && positions[g.oppId] != null);
  const at = (lo: number, hi: number) => league.filter((g) => positions[g.oppId] >= lo && positions[g.oppId] <= hi);
  const rows = [
    rowOf('home', 'Kandang', games.filter((g) => g.home)),
    rowOf('away', 'Tandang', games.filter((g) => !g.home)),
    rowOf('top6', 'Lawan 6 besar klasemen', at(1, 6)),
    rowOf('mid', 'Lawan peringkat 7–14', at(7, 14)),
    rowOf('low', 'Lawan peringkat 15–20', at(15, 20)),
  ].filter((r) => r.n > 0);

  return {
    n: games.length,
    nTimeline: tl.length,
    bins,
    h1: sumBins(0, 3),
    h2: sumBins(3, 6),
    late: sumBins(5, 6),
    state,
    cleanSheets: games.filter((g) => g.ga === 0).length,
    failedToScore: games.filter((g) => g.gf === 0).length,
    rows,
  };
}

/** Kalimat penjelas di bawah angka, selalu mengikuti data. */
export function h2Insight(h1: { gf: number; ga: number }, h2: { gf: number; ga: number }): string {
  const d1 = h1.gf - h1.ga;
  const d2 = h2.gf - h2.ga;
  return d2 > d1 ? 'lebih tajam setelah jeda' : d2 < d1 ? 'lebih lemah setelah jeda' : 'sama kuat di kedua babak';
}
export function lateInsight(late: { gf: number; ga: number }): string {
  return late.gf > late.ga ? 'kuat di menit akhir' : late.gf < late.ga ? 'rawan di menit akhir' : 'seimbang di menit akhir';
}
