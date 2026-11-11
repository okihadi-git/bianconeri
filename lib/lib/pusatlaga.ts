// "Pusat laga": analisis satu pertandingan Juventus dari komentar Opta di ESPN.
// Fungsi murni (tanpa fetch). Semua angka turunan (xG per tembakan, momentum, peluang menang) adalah ESTIMASI:
//  - xG per tembakan diperkirakan dari lokasi yang disebut komentar ("from the centre of the box", dst.), lalu total tiap
//    tim disamakan dengan xG resmi ESPN bila ada.
//  - posisi titik di peta adalah perkiraan zona, bukan koordinat persis.

export type Side = 'juve' | 'opp';
export type Outcome = 'goal' | 'saved' | 'missed' | 'post' | 'blocked';

export interface RawComment {
  text: string;
  minute: number;
  added: number;
}

export interface Shot {
  minute: number;
  added: number;
  team: Side;
  player: string;
  outcome: Outcome;
  onTarget: boolean;
  /** koordinat lapangan 105 × 68; Juventus selalu menyerang ke kanan (x = 105 adalah gawang lawan) */
  x: number;
  y: number;
  xg: number;
  big: boolean;
  note: string;
}

export interface PressureEvent {
  minute: number;
  team: Side;
  w: number;
}

export interface GoalEvent {
  minute: number;
  team: Side;
  player: string;
}

export interface Parsed {
  shots: Shot[];
  pressure: PressureEvent[];
  goals: GoalEvent[];
}

const norm = (s: string) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function parseMinute(display: string): { minute: number; added: number } {
  const m = /(\d+)\s*'?\s*(?:\+\s*(\d+))?/.exec(String(display ?? ''));
  return m ? { minute: Number(m[1]), added: Number(m[2] ?? 0) } : { minute: 0, added: 0 };
}

/** Samakan nama tim di teks komentar dengan sisi Juventus/lawan. */
export function sideOf(name: string, oppName: string): Side | null {
  const n = norm(name);
  if (!n) return null;
  if (n.includes('juventus')) return 'juve';
  const o = norm(oppName);
  if (o && (n === o || n.includes(o) || o.includes(n))) return 'opp';
  return null;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

interface Zone {
  re: RegExp;
  d: number; // jarak ke garis gawang (meter)
  lat: number; // jarak ke sumbu tengah (meter)
  xg: number;
}
/** Urutan penting: frasa paling spesifik dulu. */
const ZONES: Zone[] = [
  { re: /very close range/i, d: 3, lat: 0, xg: 0.45 },
  { re: /six yard box/i, d: 5, lat: 0, xg: 0.32 },
  { re: /difficult angle and long range/i, d: 24, lat: 18, xg: 0.015 },
  { re: /difficult angle/i, d: 6, lat: 20, xg: 0.04 },
  { re: /centre of the box/i, d: 11, lat: 0, xg: 0.13 },
  { re: /(?:left|right) side of the box/i, d: 12, lat: 13, xg: 0.07 },
  { re: /outside the box/i, d: 21, lat: 0, xg: 0.035 },
  { re: /(?:very )?long range|more than \d+ yards|over \d+ yards/i, d: 32, lat: 0, xg: 0.015 },
];

/** Bangun satu tembakan dari baris komentar, atau null kalau bukan tembakan. */
export function parseShot(c: RawComment, oppName: string, idx = 0): Shot | null {
  const t = c.text.trim();
  const isGoal = /^Goal!/i.test(t);
  const isPen = /^Penalty (?:saved|missed)/i.test(t) || /converts the penalty/i.test(t);
  const isAttempt = /^Attempt (?:saved|missed|blocked)/i.test(t);
  if (!isGoal && !isPen && !isAttempt) return null;

  // buang awalan ("Goal! Juventus 1, Hull City 0.", "Attempt saved.", "Penalty saved!") sebelum nama pemain
  const body = t
    .replace(/^Goal!\s+.+?\d+,\s+.+?\d+\.\s*/i, '')
    .replace(/^Goal!\s*/i, '')
    .replace(/^Attempt \w+\.\s*/i, '')
    .replace(/^Penalty \w+!?\s*/i, '');
  // nama pemain = potongan kalimat tepat sebelum "(Tim)"; awalan seperti "Still 0-0." ikut terbuang karena berhenti di titik
  const who = /(?:^|\.\s+)([^.()]+?)\s+\(([^)]+)\)/.exec(body);
  if (!who) return null;
  const team = sideOf(who[2], oppName);
  if (!team) return null;

  const outcome: Outcome = isGoal ? 'goal' : /saved/i.test(t.split('.')[0]) ? 'saved' : /blocked/i.test(t.split('.')[0]) ? 'blocked' : /hits the (?:bar|post)|woodwork|crossbar|off the (?:bar|post)/i.test(t) ? 'post' : 'missed';
  const header = /header/i.test(body);
  const freeKick = /free kick/i.test(body) && !/penalty/i.test(body);

  let d = 16;
  let lat = 0;
  let xg = 0.05;
  if (isPen) {
    d = 11;
    xg = 0.76;
  } else {
    const z = ZONES.find((zz) => zz.re.test(body));
    if (z) ({ d, lat, xg } = z);
    if (freeKick && !z) {
      d = 23;
      xg = 0.06;
    }
  }
  if (header && !isPen) xg *= 0.7;

  // sisi kiri/kanan dari sudut pandang penyerang
  const right = /right side of the box|difficult angle on the right|right wing/i.test(body);
  const left = /left side of the box|difficult angle on the left|left wing/i.test(body);
  let sign = right ? 1 : left ? -1 : hash(`${t}|${idx}`) < 0.5 ? -1 : 1;
  if (!lat) sign = hash(`${t}|${idx}`) < 0.5 ? -1 : 1; // titik tengah: sebar sedikit supaya tidak menumpuk
  const jitterD = (hash(`d${t}${idx}`) - 0.5) * 3;
  const jitterY = lat ? (hash(`y${t}${idx}`) - 0.5) * 3 : (hash(`y${t}${idx}`) - 0.5) * 9;
  const dist = Math.max(1.5, d + jitterD);
  // Juventus menyerang ke kanan (+x), lawan ke kiri. y bertambah ke bawah: kanan penyerang = bawah saat menyerang ke kanan.
  const dy = (lat ? sign * lat : 0) + jitterY;
  const x = team === 'juve' ? 105 - dist : dist;
  const y = Math.min(66, Math.max(2, team === 'juve' ? 34 + dy : 34 - dy));

  const note = isPen ? 'penalti' : header ? 'sundulan' : freeKick ? 'tendangan bebas' : /(?:following|from) a corner|set piece/i.test(body) ? 'situasi bola mati' : 'permainan terbuka';
  return { minute: c.minute, added: c.added, team, player: who[1].trim(), outcome, onTarget: outcome === 'goal' || outcome === 'saved', x, y, xg: Math.min(0.95, xg), big: xg >= 0.3, note };
}

/** Pisahkan komentar menjadi tembakan, kejadian tekanan (sepak pojok, tendangan bebas, offside), dan gol. */
export function parseCommentary(items: RawComment[], oppName: string): Parsed {
  const shots: Shot[] = [];
  const pressure: PressureEvent[] = [];
  const goals: GoalEvent[] = [];

  items.forEach((c, i) => {
    const t = c.text.trim();
    const shot = parseShot(c, oppName, i);
    if (shot) {
      shots.push(shot);
      if (shot.outcome === 'goal') goals.push({ minute: c.minute, team: shot.team, player: shot.player });
      return;
    }
    const own = /^Own Goal by\s+(.+?),\s*([^.]+)\./i.exec(t);
    if (own) {
      const ownTeam = sideOf(own[2], oppName);
      if (ownTeam) goals.push({ minute: c.minute, team: ownTeam === 'juve' ? 'opp' : 'juve', player: `${own[1]} (bunuh diri)` });
      return;
    }
    const corner = /^Corner,\s*([^.]+)\./i.exec(t);
    if (corner) {
      const s = sideOf(corner[1], oppName);
      if (s) pressure.push({ minute: c.minute, team: s, w: 0.8 });
      return;
    }
    const off = /^Offside,\s*([^.]+)\./i.exec(t);
    if (off) {
      const s = sideOf(off[1], oppName);
      if (s) pressure.push({ minute: c.minute, team: s, w: 0.3 });
      return;
    }
    const fk = /\(([^)]+)\)\s+wins a free kick in the attacking half/i.exec(t);
    if (fk) {
      const s = sideOf(fk[1], oppName);
      if (s) pressure.push({ minute: c.minute, team: s, w: 0.4 });
    }
  });
  return { shots, pressure, goals };
}

/** Samakan total xG tiap tim dengan xG resmi (bila ada). Mengembalikan faktor pengali yang dipakai. */
export function scaleXg(shots: Shot[], official: { juve?: number | null; opp?: number | null }): { juve: number; opp: number } {
  const out = { juve: 1, opp: 1 };
  for (const side of ['juve', 'opp'] as const) {
    const raw = shots.filter((s) => s.team === side).reduce((n, s) => n + s.xg, 0);
    const target = official[side];
    if (target != null && target > 0 && raw > 0) out[side] = Math.min(4, Math.max(0.25, target / raw));
  }
  for (const s of shots) s.xg = Math.min(0.95, s.xg * out[s.team]);
  return out;
}

export interface MomentumBar {
  minute: number;
  juve: number;
  opp: number;
}

/** Tekanan per menit: tembakan (bobot xG), sepak pojok, tendangan bebas di sepertiga akhir, dan offside; dihaluskan ±2 menit. */
export function momentum(shots: Shot[], pressure: PressureEvent[], maxMinute = 90): { bars: MomentumBar[]; juveShare: number | null } {
  const N = Math.max(90, maxMinute);
  const raw = { juve: new Array(N + 1).fill(0), opp: new Array(N + 1).fill(0) };
  const add = (side: Side, minute: number, w: number) => {
    raw[side][Math.min(N, Math.max(1, minute))] += w;
  };
  for (const s of shots) add(s.team, s.minute, 0.6 + 6 * s.xg);
  for (const p of pressure) add(p.team, p.minute, p.w);

  const kernel = [1, 2, 3, 2, 1];
  const ksum = 9;
  const smooth = (a: number[]) => a.map((_, i) => kernel.reduce((n, k, j) => n + k * (a[i + j - 2] ?? 0), 0) / ksum);
  const sj = smooth(raw.juve);
  const so = smooth(raw.opp);
  const peak = Math.max(0.0001, ...sj, ...so);
  const bars: MomentumBar[] = [];
  for (let m = 1; m <= N; m++) bars.push({ minute: m, juve: sj[m] / peak, opp: so[m] / peak });
  const tj = raw.juve.reduce((a, b) => a + b, 0);
  const to = raw.opp.reduce((a, b) => a + b, 0);
  return { bars, juveShare: tj + to > 0 ? tj / (tj + to) : null };
}

/** Peluang menang/seri/kalah akhir: P(selisih saat ini + Poisson(muJ) − Poisson(muO) > / = / < 0). */
export function finalProbs(lead: number, muJ: number, muO: number): { juve: number; draw: number; opp: number } {
  if (muJ <= 0 && muO <= 0) return { juve: lead > 0 ? 1 : 0, draw: lead === 0 ? 1 : 0, opp: lead < 0 ? 1 : 0 };
  const MAX = 12;
  const pmf = (l: number) => {
    const out = [Math.exp(-l)];
    for (let k = 1; k <= MAX; k++) out.push((out[k - 1] * l) / k);
    return out;
  };
  const a = pmf(muJ);
  const b = pmf(muO);
  let w = 0;
  let d = 0;
  let l = 0;
  for (let x = 0; x <= MAX; x++) {
    for (let y = 0; y <= MAX; y++) {
      const diff = lead + x - y;
      const p = a[x] * b[y];
      if (diff > 0) w += p;
      else if (diff === 0) d += p;
      else l += p;
    }
  }
  const tot = w + d + l;
  return { juve: w / tot, draw: d / tot, opp: l / tot };
}

export interface WinPoint {
  t: number;
  juve: number;
  draw: number;
  opp: number;
}

/**
 * Peluang menang tiap menit 0–90. Laju gol tiap tim = campuran laju awal (dari kekuatan musim ini) dan xG yang sudah tercipta di laga ini,
 * dihitung ulang tiap menit; gol yang masih mungkin = laju × sisa waktu; skor sekarang dipakai apa adanya.
 */
export function winProbability(args: { goals: GoalEvent[]; shots: Shot[]; prior: { juve: number; opp: number }; weight?: number }): WinPoint[] {
  const W = args.weight ?? 0.5; // bobot laju awal, dihitung sebagai "setengah laga"
  const out: WinPoint[] = [];
  for (let t = 0; t <= 90; t++) {
    const gj = args.goals.filter((g) => g.team === 'juve' && g.minute <= t).length;
    const go = args.goals.filter((g) => g.team === 'opp' && g.minute <= t).length;
    const xj = args.shots.filter((s) => s.team === 'juve' && s.minute <= t).reduce((n, s) => n + s.xg, 0);
    const xo = args.shots.filter((s) => s.team === 'opp' && s.minute <= t).reduce((n, s) => n + s.xg, 0);
    const rate = (p: number, x: number) => (p * W + x) / (W + t / 90);
    const left = (90 - t) / 90;
    out.push({ t, ...finalProbs(gj - go, rate(args.prior.juve, xj) * left, rate(args.prior.opp, xo) * left) });
  }
  return out;
}
