// "Jalur ke Eropa" / "Jalan ke trofi": perhitungan untuk tab di halaman Kompetisi (Serie A).
// Fungsi murni tanpa fetch, supaya mudah diuji. Dua mode:
//  - 'eropa': Juventus berebut 4 besar (zona Liga Champions)
//  - 'gelar': Juventus ikut berebut juara (otomatis, lihat pickMode)
// Angka sejarah (poin juara / peringkat 4 tiap musim) datang dari ESPN lewat /api/jalur; tanpa itu target historis disembunyikan.
import type { Team } from './types';

export type JalurMode = 'eropa' | 'gelar';

export interface HistorySeason {
  season: string; // "2024/25"
  first: { name: string; points: number } | null;
  fourth: { name: string; points: number } | null;
}

/** Selisih poin ke pemuncak (dua kemenangan) yang masih dianggap ikut perebutan gelar. */
export const TITLE_GAP = 6;
/** Peringkat terendah yang dianggap ikut perebutan gelar. */
export const TITLE_MAX_RANK = 3;

export type Tone = 'green' | 'orange' | 'red' | 'blue' | 'gray';
export interface Seg {
  t: string;
  b?: boolean;
}

export interface JalurCard {
  label: string;
  value: string;
  sub: string;
}

export interface JalurTarget {
  key: 'low' | 'avg' | 'safe';
  label: string;
  points: number;
  need: number;
  wins: number;
  perGame: number | null;
  progress: number;
  status: { tone: Tone; text: string };
  note: string;
}

export interface JalurBar {
  name: string;
  logo: string;
  isJuve: boolean;
  points: number;
  proj: number;
  max: number;
}

export interface JalurRow {
  pos: number;
  name: string;
  logo: string;
  isJuve: boolean;
  points: number;
  diff: number;
  proj: number;
  max: number;
  status: { tone: Tone; text: string };
}

export interface Jalur {
  mode: JalurMode;
  title: string;
  /** teks ringkas di pita atas */
  summary: string;
  state: { tone: Tone; text: string };
  cards: JalurCard[];
  story: Seg[][];
  axisMax: number;
  bars: JalurBar[];
  markers: { label: string; points: number; tone: 'gray' | 'purple' | 'gold' }[];
  targets: JalurTarget[];
  rows: JalurRow[];
  rowsNote: string;
  hasHistory: boolean;
  historyCount: number;
}

export const isJuve = (t: Team) => t.name.includes('Juventus');
export const totalGamesOf = (teams: number) => Math.max(2, (teams - 1) * 2);
const dec = (n: number) => n.toFixed(2).replace('.', ',');
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** Pilih mode otomatis: 'gelar' bila Juventus masih mungkin juara dan dekat dengan pemuncak. */
export function pickMode(standings: Team[]): JalurMode {
  const juve = standings.find(isJuve);
  const leader = [...standings].sort((a, b) => a.position - b.position)[0];
  if (!juve || !leader || standings.length < 4) return 'eropa';
  const remaining = totalGamesOf(standings.length) - juve.playedGames;
  const canWin = juve.points + 3 * remaining >= leader.points;
  const close = juve.position === 1 || (juve.position <= TITLE_MAX_RANK && leader.points - juve.points <= TITLE_GAP);
  return canWin && close ? 'gelar' : 'eropa';
}

export function computeJalur(standings: Team[], history: HistorySeason[], mode: JalurMode): Jalur | null {
  const sorted = [...standings].sort((a, b) => a.position - b.position);
  const juve = sorted.find(isJuve);
  if (!juve || !juve.playedGames || sorted.length < 5) return null;

  const total = totalGamesOf(sorted.length);
  const K = mode === 'gelar' ? 1 : 4;
  const info = (t: Team) => {
    const rem = Math.max(0, total - t.playedGames);
    const ppg = t.playedGames ? t.points / t.playedGames : 0;
    return { t, rem, ppg, proj: Math.round(t.points + ppg * rem), max: t.points + 3 * rem };
  };
  const J = info(juve);
  const rivals = sorted.filter((t) => t !== juve).map(info);

  /* klub pembanding untuk kartu ketiga dan grafik */
  const byPos = (n: number) => sorted[n - 1];
  let compare: Team;
  let gapLabel: string;
  if (mode === 'gelar') {
    compare = juve.position === 1 ? byPos(2) : byPos(1);
    gapLabel = juve.position === 1 ? 'Unggul dari #2' : 'Tertinggal dari #1';
  } else if (juve.position <= 3) {
    compare = byPos(4);
    gapLabel = 'Unggul dari #4';
  } else if (juve.position === 4) {
    compare = byPos(5);
    gapLabel = 'Unggul dari #5';
  } else {
    compare = byPos(4);
    gapLabel = 'Tertinggal dari #4';
  }
  const C = info(compare);
  const gap = juve.points - compare.points; // positif = unggul

  /* target sejarah dan target aman */
  const hist = history.map((h) => (K === 1 ? h.first : h.fourth)).filter((x): x is { name: string; points: number } => Boolean(x));
  const histSeasons = history.filter((h) => (K === 1 ? h.first : h.fourth));
  const lowest = hist.length ? histSeasons.reduce((a, b) => ((K === 1 ? a.first : a.fourth)!.points <= (K === 1 ? b.first : b.fourth)!.points ? a : b)) : null;
  const lowestPts = lowest ? (K === 1 ? lowest.first : lowest.fourth)!.points : 0;
  const avgPts = hist.length ? Math.round(hist.reduce((n, x) => n + x.points, 0) / hist.length) : 0;
  const rivalMax = rivals.map((r) => r.max).sort((a, b) => b - a);
  const safe = Math.min(total * 3, (rivalMax[K - 1] ?? 0) + 1);

  const word = mode === 'gelar' ? { low: 'Juara terendah', avg: 'Rata-rata juara', safe: 'Pasti juara', what: 'juara' } : { low: '4 besar terendah', avg: 'Rata-rata 4 besar', safe: 'Pasti 4 besar', what: '4 besar' };
  const mkTarget = (key: JalurTarget['key'], label: string, points: number, note: string): JalurTarget => {
    const need = Math.max(0, points - juve.points);
    const perGame = J.rem ? need / J.rem : null;
    const feasible = need <= 3 * J.rem;
    const status: JalurTarget['status'] =
      need === 0 ? { tone: 'green', text: 'Sudah tercapai' } : !feasible ? { tone: 'red', text: 'Tidak mungkin tercapai' } : perGame !== null && J.ppg >= perGame ? { tone: 'green', text: `Ritme sekarang cukup (${dec(J.ppg)})` } : { tone: 'orange', text: `Perlu lebih cepat (sekarang ${dec(J.ppg)})` };
    return { key, label, points, need, wins: Math.ceil(need / 3), perGame, progress: Math.min(1, juve.points / Math.max(1, points)), status, note };
  };

  const targets: JalurTarget[] = [];
  if (lowest) {
    const l = (K === 1 ? lowest.first : lowest.fourth)!;
    targets.push(mkTarget('low', word.low, lowestPts, `Poin ${mode === 'gelar' ? 'juara' : 'peringkat 4'} paling sedikit dalam ${hist.length} musim terakhir (${l.name} ${lowest.season}).`));
    targets.push(mkTarget('avg', word.avg, avgPts, `Rata-rata poin ${mode === 'gelar' ? 'sang juara' : 'peringkat 4'} dalam ${hist.length} musim terakhir. Target realistis.`));
  }
  targets.push(mkTarget('safe', word.safe, safe, `Angka aman: tidak bisa dikejar ${mode === 'gelar' ? 'tim mana pun' : 'lebih dari tiga tim'}, apa pun hasil mereka (selisih gol tidak dihitung).`));

  /* cerita */
  const refTarget = targets.find((t) => t.key === 'avg') ?? targets.find((t) => t.key === 'safe')!;
  const story: Seg[][] = [];
  const tail = gap > 0 ? [{ t: 'unggul ' }, { t: `${gap} poin`, b: true }] : gap < 0 ? [{ t: 'tertinggal ' }, { t: `${-gap} poin`, b: true }] : [{ t: 'sama poin' }];
  story.push([
    { t: 'Setelah ' }, { t: `${juve.playedGames} laga`, b: true }, { t: ', Juventus mengumpulkan ' }, { t: `${juve.points} poin`, b: true },
    { t: ` (${juve.won} menang, ${juve.draw} seri, ${juve.lost} kalah) dan ada di ` }, { t: `peringkat ${juve.position}`, b: true }, { t: ', ' },
    ...tail, { t: ` dari ${compare.name}${juve.position === compare.position ? '' : ` (peringkat ${compare.position})`}. Masih ada ` }, { t: `${J.rem} laga`, b: true }, { t: ', atau ' }, { t: `${J.rem * 3} poin`, b: true }, { t: ', yang bisa diperebutkan.' },
  ]);
  if (hist.length) {
    story.push([
      { t: `Rata-rata ${mode === 'gelar' ? 'juara' : 'peringkat 4'} dalam ${hist.length} musim terakhir mengumpulkan ` }, { t: `${avgPts} poin`, b: true },
      ...(refTarget.need > 0
        ? [{ t: '. Untuk menyamainya, Juventus butuh ' }, { t: `${refTarget.need} poin lagi`, b: true }, { t: `, misalnya ${refTarget.wins} kemenangan dari ${J.rem} laga sisa, atau rata-rata ${dec(refTarget.perGame ?? 0)} poin per laga.` }]
        : [{ t: '. Juventus sudah melampauinya.' }]),
    ]);
  }
  const reaches = hist.length ? J.proj >= avgPts : J.proj >= safe;
  story.push([
    { t: 'Saat ini Juventus meraup ' }, { t: `${dec(J.ppg)} poin per laga`, b: true }, { t: '. Kalau ritme itu bertahan, Juventus finis dengan sekitar ' }, { t: `${J.proj} poin`, b: true },
    { t: `, sementara ${compare.name} di ritmenya sendiri (${dec(C.ppg)} per laga) menuju ±${C.proj} poin. ` },
    { t: reaches ? `Artinya Juventus sedang di jalur finis di ${word.what}.` : `Artinya ritme sekarang belum cukup untuk menyamai ${hist.length ? `rata-rata ${word.what}` : 'angka aman'}.` },
  ]);
  story.push([
    { t: `Posisi ${word.what} bisa dipastikan tanpa bergantung pada tim lain jika Juventus mencapai ` }, { t: `${safe} poin`, b: true },
    { t: safe > J.max ? `. Angka itu melebihi poin maksimal Juventus (${J.max}), jadi belum bisa dipastikan sendiri.` : '. Selisih gol belum dihitung di angka ini.' },
  ]);

  /* status besar */
  const refPoints = byPos(K).points;
  const state: Jalur['state'] =
    juve.points >= safe ? { tone: 'green', text: mode === 'gelar' ? 'Pasti juara' : 'Pasti 4 besar' }
    : juve.position <= K ? { tone: 'green', text: mode === 'gelar' ? 'Di jalur juara' : 'Di zona 4 besar' }
    : J.max >= refPoints ? { tone: 'orange', text: mode === 'gelar' ? 'Masih bersaing' : 'Masih berpeluang' }
    : { tone: 'red', text: mode === 'gelar' ? 'Di luar perebutan gelar' : 'Di luar jangkauan' };

  /* kartu */
  const cards: JalurCard[] = [
    { label: 'Peringkat', value: `#${juve.position}`, sub: mode === 'eropa' ? (juve.position <= 4 ? 'Zona Liga Champions' : juve.position === 5 ? 'Zona Liga Europa' : 'Di luar zona Eropa') : juve.position === 1 ? 'Pemuncak klasemen' : 'Mengejar pemuncak' },
    { label: 'Poin', value: String(juve.points), sub: `${juve.won}M ${juve.draw}S ${juve.lost}K` },
    { label: gapLabel, value: signed(gap), sub: compare.name },
    { label: 'Sisa laga', value: String(J.rem), sub: `${J.rem * 3} poin tersedia` },
  ];

  /* grafik */
  const axisMax = Math.ceil((total * 3) / 20) * 20;
  const bar = (i: ReturnType<typeof info>): JalurBar => ({ name: i.t.name, logo: i.t.logo, isJuve: i.t === juve, points: i.t.points, proj: i.proj, max: i.max });
  const markers: Jalur['markers'] = [];
  if (lowest) {
    markers.push({ label: String(lowestPts), points: lowestPts, tone: 'gray' });
    if (avgPts !== lowestPts) markers.push({ label: String(avgPts), points: avgPts, tone: 'purple' });
  }
  markers.push({ label: String(safe), points: safe, tone: 'gold' });

  /* tabel pesaing */
  const refClub = byPos(K);
  const statusOf = (r: ReturnType<typeof info>): JalurRow['status'] => {
    if (mode === 'gelar') {
      return r.t.position === 1 ? { tone: 'green', text: 'Pemuncak' } : r.max >= refClub.points ? { tone: 'green', text: 'Masih bisa juara' } : { tone: 'gray', text: 'Tersingkir dari gelar' };
    }
    return r.t.position <= 4 ? { tone: 'green', text: 'Zona 4 besar' } : r.max >= refClub.points ? { tone: 'blue', text: 'Masih bisa 4 besar' } : { tone: 'gray', text: 'Sulit 4 besar' };
  };
  const all = sorted.map(info);
  const rows = (mode === 'gelar' ? all.filter((r) => r.t === juve || r.max >= refClub.points) : all.filter((r) => r.t.position <= 8 || r.t === juve)).slice(0, 10).map((r): JalurRow => ({
    pos: r.t.position, name: r.t.name, logo: r.t.logo, isJuve: r.t === juve, points: r.t.points, diff: r.t.points - juve.points, proj: r.proj, max: r.max, status: statusOf(r),
  }));

  const gapPhrase = gap > 0 ? `unggul ${gap} dari ${compare.name}` : gap < 0 ? `tertinggal ${-gap} dari ${compare.name}` : `sama poin dengan ${compare.name}`;
  return {
    mode,
    title: mode === 'gelar' ? 'Jalan ke trofi' : 'Jalur ke Eropa',
    summary: `#${juve.position} · ${juve.points} poin · ${gapPhrase} · ${J.rem} laga sisa`,
    state,
    cards,
    story,
    axisMax,
    bars: [bar(J), bar(C)],
    markers,
    targets,
    rows,
    rowsNote: mode === 'gelar' ? '“Masih bisa juara” berarti poin maksimal klub itu masih bisa menyamai pemuncak saat ini.' : '“Masih bisa 4 besar” berarti poin maksimal klub itu masih bisa menyamai peringkat 4 saat ini. Selisih gol dan head-to-head tidak dihitung.',
    hasHistory: hist.length > 0,
    historyCount: hist.length,
  };
}
