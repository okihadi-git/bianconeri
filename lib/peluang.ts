// Simulasi sisa musim (Monte Carlo) untuk "Peluang juara & top 4". Fungsi murni tanpa fetch, mudah diuji.
// Model: tiap tim punya kekuatan serang dan bertahan dari gol musim ini, ditarik ke rata-rata liga (shrinkage) supaya tidak
// berlebihan di awal musim; jumlah gol tiap laga diundi dari distribusi Poisson dengan keuntungan kandang.
// Urutan akhir: poin, selisih gol, lalu gol (bukan aturan head-to-head Serie A).

export interface SimTeam {
  id: string;
  points: number;
  played: number;
  gf: number;
  ga: number;
  gd: number;
}

export interface SimInput {
  teams: SimTeam[];
  /** laga yang belum dimainkan: [idTuanRumah, idTamu] */
  remaining: [string, string][];
  /** rata-rata gol per laga tuan rumah / tamu di liga ini */
  muHome: number;
  muAway: number;
  sims?: number;
  seed?: number;
  /** bobot rata-rata liga, dihitung sebagai "laga tambahan" */
  priorGames?: number;
  ucl?: number; // jumlah tempat Liga Champions
  relegation?: number; // jumlah tim degradasi
}

export interface SimOut {
  id: string;
  /** rata-rata poin akhir */
  proj: number;
  title: number;
  ucl: number;
  rel: number;
  /** peluang finis di tiap posisi (indeks 0 = juara) */
  dist: number[];
  mostLikely: number; // posisi, mulai 1
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulate(inp: SimInput): SimOut[] {
  const { teams, remaining, muHome, muAway } = inp;
  const n = teams.length;
  const sims = inp.sims ?? 10_000;
  const K = inp.priorGames ?? 6;
  const ucl = inp.ucl ?? 4;
  const relN = inp.relegation ?? 3;
  const rnd = mulberry32(inp.seed ?? 1);

  const idx = new Map(teams.map((t, i) => [t.id, i]));
  const mu = (muHome + muAway) / 2;
  // rasio serang/bertahan relatif terhadap rata-rata liga, ditarik ke 1.0 dengan bobot K laga
  const att = teams.map((t) => (t.gf + K * mu) / ((t.played + K) * mu));
  const def = teams.map((t) => (t.ga + K * mu) / ((t.played + K) * mu));

  const home: number[] = [];
  const away: number[] = [];
  const Lh: number[] = [];
  const La: number[] = [];
  for (const [h, a] of remaining) {
    const hi = idx.get(h);
    const ai = idx.get(a);
    if (hi === undefined || ai === undefined || hi === ai) continue;
    home.push(hi);
    away.push(ai);
    Lh.push(Math.exp(-muHome * att[hi] * def[ai]));
    La.push(Math.exp(-muAway * att[ai] * def[hi]));
  }
  const m = home.length;

  const counts = new Int32Array(n * n);
  const sumPts = new Float64Array(n);
  const pts = new Int16Array(n);
  const gd = new Int16Array(n);
  const gf = new Int16Array(n);
  const order = Array.from({ length: n }, (_, i) => i);

  const poisson = (L: number) => {
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rnd();
    } while (p > L);
    return k - 1;
  };

  for (let s = 0; s < sims; s++) {
    for (let i = 0; i < n; i++) {
      pts[i] = teams[i].points;
      gd[i] = teams[i].gd;
      gf[i] = teams[i].gf;
    }
    for (let j = 0; j < m; j++) {
      const h = home[j];
      const a = away[j];
      const x = poisson(Lh[j]);
      const y = poisson(La[j]);
      gf[h] += x;
      gf[a] += y;
      gd[h] += x - y;
      gd[a] += y - x;
      if (x > y) pts[h] += 3;
      else if (x < y) pts[a] += 3;
      else {
        pts[h] += 1;
        pts[a] += 1;
      }
    }
    for (let i = 0; i < n; i++) order[i] = i;
    order.sort((p, q) => pts[q] - pts[p] || gd[q] - gd[p] || gf[q] - gf[p] || p - q);
    for (let r = 0; r < n; r++) counts[order[r] * n + r]++;
    for (let i = 0; i < n; i++) sumPts[i] += pts[i];
  }

  return teams.map((t, i) => {
    const dist = Array.from({ length: n }, (_, r) => counts[i * n + r] / sims);
    let best = 0;
    dist.forEach((p, r) => {
      if (p > dist[best]) best = r;
    });
    return {
      id: t.id,
      proj: sumPts[i] / sims,
      title: dist[0],
      ucl: dist.slice(0, ucl).reduce((a, b) => a + b, 0),
      rel: dist.slice(n - relN).reduce((a, b) => a + b, 0),
      dist,
      mostLikely: best + 1,
    };
  });
}

/** Semua pasangan (kandang, tamu) dalam liga ganda penuh yang belum dimainkan. */
export function remainingPairs(ids: string[], played: [string, string][]): [string, string][] {
  const done = new Set(played.map(([h, a]) => `${h}|${a}`));
  const out: [string, string][] = [];
  for (const h of ids) for (const a of ids) if (h !== a && !done.has(`${h}|${a}`)) out.push([h, a]);
  return out;
}
