// "Analisa → Lawan berikutnya": perhitungan murni (tanpa fetch) untuk prediksi skor, perbandingan musim, dan cuaca.

export interface TeamMatch {
  iso: string;
  /** true = tim ini tuan rumah */
  home: boolean;
  oppId: string;
  oppName: string;
  gf: number;
  ga: number;
}

export interface Rec {
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
}

const empty = (): Rec => ({ played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });

export function record(ms: TeamMatch[]): Rec {
  const r = empty();
  for (const m of ms) {
    r.played++;
    r.gf += m.gf;
    r.ga += m.ga;
    if (m.gf > m.ga) r.w++;
    else if (m.gf === m.ga) r.d++;
    else r.l++;
  }
  return r;
}

/** Rekor keseluruhan, kandang, dan tandang dari daftar laga selesai (urutan bebas). */
export function splits(ms: TeamMatch[]) {
  return { all: record(ms), home: record(ms.filter((m) => m.home)), away: record(ms.filter((m) => !m.home)) };
}

/** Hasil 5 laga terakhir, lama → baru: M (menang), S (seri), K (kalah). */
export function lastFive(ms: TeamMatch[]): ('M' | 'S' | 'K')[] {
  return [...ms]
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .slice(-5)
    .map((m) => (m.gf > m.ga ? 'M' : m.gf === m.ga ? 'S' : 'K'));
}

/** Pembulatan persentase agar jumlahnya tepat 100 (metode sisa terbesar). */
export function roundTo100(parts: number[]): number[] {
  const total = parts.reduce((a, b) => a + b, 0) || 1;
  const raw = parts.map((p) => (p / total) * 100);
  const base = raw.map(Math.floor);
  let left = 100 - base.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  for (const o of order) {
    if (left <= 0) break;
    base[o.i]++;
    left--;
  }
  return base;
}

export interface Prediction {
  /** peluang menang/seri/kalah Juventus, dalam persen bulat (jumlah = 100) */
  win: number;
  draw: number;
  loss: number;
  lambdaJuve: number;
  lambdaOpp: number;
  top: { score: string; p: number }[];
}

/** Skor Juventus–lawan dari dua Poisson: peluang menang/seri/kalah dan tiga skor paling mungkin. */
export function predict(lambdaJuve: number, lambdaOpp: number): Prediction {
  const MAX = 10;
  const pmf = (l: number) => {
    const out = [Math.exp(-l)];
    for (let k = 1; k <= MAX; k++) out.push((out[k - 1] * l) / k);
    return out;
  };
  const a = pmf(lambdaJuve);
  const b = pmf(lambdaOpp);
  let w = 0;
  let d = 0;
  let l = 0;
  const cells: { score: string; p: number }[] = [];
  for (let x = 0; x <= MAX; x++) {
    for (let y = 0; y <= MAX; y++) {
      const p = a[x] * b[y];
      cells.push({ score: `${x}–${y}`, p });
      if (x > y) w += p;
      else if (x === y) d += p;
      else l += p;
    }
  }
  const [win, draw, loss] = roundTo100([w, d, l]);
  const top = cells.sort((m, n) => n.p - m.p).slice(0, 3).map((c) => ({ score: c.score, p: Math.round(c.p * 100) }));
  return { win, draw, loss, lambdaJuve, lambdaOpp, top };
}

/* ---------- cuaca ---------- */

/** Kode cuaca WMO (Open-Meteo) → teks Indonesia dan ikon. */
export function weatherInfo(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Cerah', icon: '☀️' };
  if (code === 1) return { label: 'Cerah berawan', icon: '🌤️' };
  if (code === 2) return { label: 'Berawan sebagian', icon: '⛅' };
  if (code === 3) return { label: 'Mendung', icon: '☁️' };
  if (code === 45 || code === 48) return { label: 'Berkabut', icon: '🌫️' };
  if (code >= 51 && code <= 57) return { label: 'Gerimis', icon: '🌦️' };
  if (code >= 61 && code <= 67) return { label: 'Hujan', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { label: 'Salju', icon: '❄️' };
  if (code >= 80 && code <= 82) return { label: 'Hujan deras sesaat', icon: '🌧️' };
  if (code === 85 || code === 86) return { label: 'Salju lebat sesaat', icon: '❄️' };
  if (code >= 95) return { label: 'Badai petir', icon: '⛈️' };
  return { label: 'Cuaca tidak diketahui', icon: '🌡️' };
}

/** Kalimat ringkas tentang layak-tidaknya kondisi untuk bermain. */
export function playability(w: { temp: number; rain: number; wind: number; code: number }): string {
  const notes: string[] = [];
  if (w.code >= 95) notes.push('ada risiko badai petir');
  if (w.rain >= 70) notes.push('kemungkinan hujan cukup besar');
  if (w.wind >= 40) notes.push('angin kencang');
  if (w.temp >= 30) notes.push('cuaca panas');
  if (w.temp <= 0) notes.push('suhu sangat dingin');
  return notes.length ? `Perlu diperhatikan: ${notes.join(', ')}.` : 'Kondisi normal untuk bermain.';
}
