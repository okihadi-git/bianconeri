// Tab "Perebutan gelar": sisa jadwal tiap klub, tingkat kesulitannya, dan angka untuk skenario poin akhir.
// Fungsi murni. Memakai model Poisson yang sama dengan tab Peluang juara (lib/peluang.ts).
//
// Tingkat kesulitan sebuah laga = ekspektasi poin sebuah tim RATA-RATA liga di laga itu (lawan dan kandang/tandang
// diperhitungkan, kekuatan klub sendiri tidak): makin kecil, makin berat. Dengan begitu klub kuat tidak otomatis
// dianggap "jadwalnya ringan" hanya karena klubnya kuat.
import { outcomeProbs, teamStrengths, type SimTeam } from './peluang';

export type Level = 'mudah' | 'sedang' | 'berat';
export type TeamLevel = 'Ringan' | 'Sedang' | 'Berat';

export interface GelarFixture {
  iso: string;
  home: boolean;
  /** id klub lawan */
  opp: string;
  /** ekspektasi poin tim rata-rata di laga ini (0–3) */
  d: number;
  level: Level;
}

export interface GelarTeam {
  id: string;
  name: string;
  abbr: string;
  logo: string;
  position: number;
  points: number;
  played: number;
  remaining: number;
  /** proyeksi poin akhir dari simulasi (model) */
  proj: number;
  /** poin akhir bila laju poin sekarang bertahan */
  projPace: number;
  /** poin maksimal bila menang semua sisa laga */
  max: number;
  /** harapan jumlah menang dan seri di sisa laga (model) */
  expW: number;
  expD: number;
  /** rata-rata ekspektasi poin tim rata-rata di sisa laga */
  avgD: number;
  /** 1 = jadwal tersulit di liga */
  diffRank: number;
  level: TeamLevel;
  fixtures: GelarFixture[];
}

export interface GelarBase extends SimTeam {
  name: string;
  abbr: string;
  logo: string;
  position: number;
}

export interface GelarInput {
  teams: GelarBase[];
  fixtures: { iso: string; homeId: string; awayId: string }[];
  muHome: number;
  muAway: number;
  /** proyeksi poin akhir dari simulasi, per id klub */
  proj: Map<string, number>;
}

const quantile = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);

export function buildGelar(inp: GelarInput): GelarTeam[] {
  const { teams, fixtures, muHome, muAway } = inp;
  const n = teams.length;
  const { att, def } = teamStrengths(teams, muHome, muAway);
  const idx = new Map(teams.map((t, i) => [t.id, i]));

  const own = teams.map(() => ({ w: 0, d: 0 }));
  type Raw = { iso: string; home: boolean; opp: string; d: number };
  const raw: Raw[][] = teams.map(() => []);

  for (const f of fixtures) {
    const h = idx.get(f.homeId);
    const a = idx.get(f.awayId);
    if (h === undefined || a === undefined || h === a) continue;
    // ekspektasi tim itu sendiri (untuk harapan menang/seri)
    const real = outcomeProbs(muHome * att[h] * def[a], muAway * att[a] * def[h]);
    own[h].w += real.win;
    own[h].d += real.draw;
    own[a].w += real.loss;
    own[a].d += real.draw;
    // kesulitan: tim rata-rata (att = def = 1) menghadapi lawan yang sama
    const asHome = outcomeProbs(muHome * 1 * def[a], muAway * att[a] * 1); // rata-rata di kandang lawan a
    const asAway = outcomeProbs(muHome * att[h] * 1, muAway * 1 * def[h]); // rata-rata bertandang ke h
    raw[h].push({ iso: f.iso, home: true, opp: f.awayId, d: 3 * asHome.win + asHome.draw });
    raw[a].push({ iso: f.iso, home: false, opp: f.homeId, d: 3 * asAway.loss + asAway.draw });
  }

  const all = raw.flat().map((r) => r.d).sort((x, y) => x - y);
  const q1 = quantile(all, 1 / 3);
  const q2 = quantile(all, 2 / 3);
  const levelOf = (d: number): Level => (d <= q1 ? 'berat' : d <= q2 ? 'sedang' : 'mudah');

  const avg = raw.map((r) => (r.length ? r.reduce((s, x) => s + x.d, 0) / r.length : 0));
  const order = avg.map((v, i) => ({ v, i })).sort((x, y) => x.v - y.v); // paling sulit dulu
  const rank = new Array<number>(n);
  order.forEach((o, r) => (rank[o.i] = r + 1));

  const out = teams.map((t, i): GelarTeam => {
    const remaining = Math.max(0, 2 * (n - 1) - t.played);
    const ppg = t.played ? t.points / t.played : 0;
    const projPace = t.points + ppg * remaining;
    const lvl: TeamLevel = rank[i] <= Math.ceil(n / 3) ? 'Berat' : rank[i] > n - Math.ceil(n / 3) ? 'Ringan' : 'Sedang';
    return {
      id: t.id,
      name: t.name,
      abbr: t.abbr,
      logo: t.logo,
      position: t.position,
      points: t.points,
      played: t.played,
      remaining,
      proj: inp.proj.get(t.id) ?? projPace,
      projPace,
      max: t.points + 3 * remaining,
      expW: own[i].w,
      expD: own[i].d,
      avgD: avg[i],
      diffRank: rank[i],
      level: lvl,
      fixtures: raw[i].sort((x, y) => x.iso.localeCompare(y.iso)).map((r) => ({ ...r, level: levelOf(r.d) })),
    };
  });
  return out.sort((a, b) => (a.position || 99) - (b.position || 99) || b.points - a.points);
}

/** Hasil skenario: Juventus finis dengan `wins` menang dan `draws` seri; rival memakai proyeksi model atau laju poin sekarang. */
export function scenario(teams: GelarTeam[], juveId: string, wins: number, draws: number, pace: boolean) {
  const juve = teams.find((t) => t.id === juveId)!;
  const final = juve.points + 3 * wins + draws;
  const others = teams.filter((t) => t.id !== juveId).map((t) => ({ t, final: Math.round(pace ? t.projPace : t.proj) }));
  const sorted = [...others].sort((a, b) => b.final - a.final || a.t.position - b.t.position);
  const leader = sorted[0];
  const rank = 1 + others.filter((o) => o.final > final).length;
  const needTotal = (leader?.final ?? 0) + 1;
  const need = Math.max(0, needTotal - juve.points);
  const rows = [{ id: juve.id, name: juve.name, logo: juve.logo, now: juve.points, final, isJuve: true }, ...others.map((o) => ({ id: o.t.id, name: o.t.name, logo: o.t.logo, now: o.t.points, final: o.final, isJuve: false }))].sort(
    (a, b) => b.final - a.final || (a.isJuve ? -1 : b.isJuve ? 1 : 0)
  );
  return {
    final,
    losses: Math.max(0, juve.remaining - wins - draws),
    rank,
    leader: leader ? { name: leader.t.name, final: leader.final } : null,
    gap: leader ? final - leader.final : 0,
    need,
    needWins: Math.ceil(need / 3),
    reachable: need <= 3 * juve.remaining,
    rows,
  };
}
