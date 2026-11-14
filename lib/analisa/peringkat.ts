// Analisa → Peringkat & keuangan → Peringkat klub: koefisien UEFA (5 musim) — 10 besar + posisi Juventus.
// Murni fungsi (tanpa fetch) agar bisa diuji. Dua sumber, dicoba berurutan di lib/peringkat-server.ts:
//   1. API data UEFA (daftar lengkap ratusan klub) — dibutuhkan karena Juventus berada di luar 25 besar.
//   2. Wikipedia "UEFA coefficient" (bagian "Men's club coefficient") — hanya 25 klub teratas, tapi strukturnya stabil.

export interface ClubRank {
  rank: number;
  name: string;
  /** kode negara 3 huruf, mis. "ITA"; null bila sumber tidak memberi */
  country: string | null;
  points: number;
  logo: string | null;
}

export interface PeringkatResponse {
  /** peringkat 1–10 */
  top: ClubRank[];
  /** baris Juventus; null bila tidak ditemukan di sumber */
  juve: ClubRank | null;
  /** klub Italia dengan peringkat tertinggi */
  italy: ClubRank | null;
  /** jumlah klub di sumber (Wikipedia: 25) */
  listed: number;
  source: 'uefa' | 'wikipedia';
  /** tanggal pembaruan sumber, mis. "3 Jun 2026"; null bila sumber tidak menyebut */
  asOf: string | null;
  /** jendela 5 musim, mis. "2022/23–2026/27" */
  window: string;
  warnings: string[];
  updatedAt: string;
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Nama dinormalkan untuk pencocokan: huruf kecil, tanpa aksen/tanda baca/awalan klub. */
export const normName = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !['fc', 'cf', 'afc', 'ac', 'as', 'sc', 'ssc', 'fk', 'sk', 'club', 'de', 'calcio', 'futbol'].includes(w))
    .join(' ')
    .trim();

export const isJuventus = (name: string) => /juventus/i.test(name);

/** Jendela 5 musim koefisien untuk tanggal tertentu. Musim baru mulai Juli: Nov 2026 → "2022/23–2026/27". */
export function seasonWindow(now = new Date()): string {
  const endYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear(); // tahun akhir musim berjalan
  const label = (end: number) => `${end - 1}/${String(end).slice(2)}`;
  return `${label(endYear - 4)}–${label(endYear)}`;
}

/** Tahun yang dipakai UEFA untuk peringkat (akhir musim berjalan), mis. 2027 untuk musim 2026/27. */
export const uefaRankingYear = (now = new Date()) => (now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear());

const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/* ---------- Wikipedia (HTML bagian "Men's club coefficient") ---------- */

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&#160;': ' ' };
const cellText = (html: string) =>
  html
    .replace(/<sup[\s\S]*?<\/sup>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|quot|#39|lt|gt|nbsp|#160);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();

/** Tanggal "as of 3 June 2026" di teks bagian itu → "3 Jun 2026". */
export function wikiAsOf(html: string): string | null {
  const m = /top\s+\d+\s+clubs\s+as\s+of\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i.exec(cellText(html));
  const mi = m ? MONTHS_EN.indexOf(m[2].toLowerCase()) : -1;
  return m && mi >= 0 ? `${Number(m[1])} ${MONTHS_ID[mi]} ${m[3]}` : null;
}

/** Tabel klub pertama di HTML: baris data = sel pertama bilangan bulat, sel klub bernama, sel terakhir total poin. */
export function parseWikiClubs(html: string): ClubRank[] {
  for (const t of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows: ClubRank[] = [];
    for (const tr of t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(cellText);
      if (cells.length < 6 || !/^\d{1,3}$/.test(cells[0])) continue;
      // sel klub: pertama yang berisi huruf dan bukan penanda pergerakan peringkat (+5, –1, –)
      const ci = cells.findIndex((c, i) => i > 0 && /[A-Za-zÀ-ÿ]{3}/.test(c));
      if (ci < 0) continue;
      const assoc = /^([A-Z]{3})(?=[\sA-Z])/.exec(cells[ci + 1] ?? '');
      const points = num(cells[cells.length - 1]);
      if (points == null) continue;
      rows.push({ rank: Number(cells[0]), name: cells[ci], country: assoc?.[1] ?? null, points, logo: null });
    }
    if (rows.length >= 10) return rows;
  }
  return [];
}

/* ---------- API data UEFA ---------- */

const trimClub = (s: string) => s.replace(/^(FC|CF|AFC|AC|AS|SSC|SC)\s+/i, '').replace(/\s+(FC|CF|AFC|SC)$/i, '').trim();

/** Cari angka pertama yang kuncinya cocok `re`, mendalam di dalam objek (kunci `skip` dilewati). */
function deepNumber(o: any, re: RegExp, skip = 'member', depth = 0): number | null {
  if (!o || typeof o !== 'object' || depth > 4) return null;
  for (const [k, v] of Object.entries(o)) {
    if (k === skip) continue;
    if (re.test(k)) {
      const n = num(v);
      if (n != null) return n;
    }
  }
  for (const [k, v] of Object.entries(o)) {
    if (k === skip || !v || typeof v !== 'object') continue;
    const n = deepNumber(v, re, skip, depth + 1);
    if (n != null) return n;
  }
  return null;
}

/** Respons coefficients UEFA → daftar klub. Kunci JSON ditulis defensif; peringkat dihitung dari poin bila tidak ada. */
export function parseUefaClubs(json: any): ClubRank[] {
  const list: any[] = json?.data?.members ?? json?.members ?? (Array.isArray(json?.data) ? json.data : []);
  if (!Array.isArray(list)) return [];
  const rows: (Omit<ClubRank, 'rank'> & { rank: number | null })[] = [];
  for (const m of list) {
    const member = m?.member ?? m;
    const raw = String(member?.displayOfficialName ?? member?.displayName ?? member?.name ?? '').trim();
    if (!raw) continue;
    const overall = m?.overallRanking ?? m?.overall ?? m;
    const points = deepNumber(overall, /^(total)?(points|coefficient)$/i) ?? deepNumber(m, /^(total)?(points|coefficient)$/i);
    if (points == null) continue;
    rows.push({
      rank: deepNumber(overall, /^(position|rank|ranking)$/i) ?? num(m?.position) ?? num(m?.rank),
      name: trimClub(raw),
      country: String(member?.countryCode ?? member?.associationCode ?? '').trim().toUpperCase().slice(0, 3) || null,
      points,
      logo: String(member?.logoUrl ?? member?.mediumLogoUrl ?? member?.bigLogoUrl ?? '') || null,
    });
  }
  if (!rows.length) return [];
  // Peringkat dari sumber dipakai kalau lengkap dan konsisten dengan urutan poin; kalau tidak, hitung dari poin.
  const ranked = rows.every((r) => r.rank != null) && rows.every((r, i) => i === 0 || (r.rank as number) >= (rows[i - 1].rank as number));
  if (ranked) return rows.map((r) => ({ ...r, rank: r.rank as number }));
  return [...rows].sort((x, y) => y.points - x.points).map((r, i) => ({ ...r, rank: i + 1 }));
}

/* ---------- logo ---------- */

/** Peta nama klub (dinormalkan) → URL logo dari daftar tim ESPN. */
export function logoMap(teamLists: any[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const data of teamLists) {
    const teams: any[] = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
    for (const { team } of teams) {
      const logo = team?.logos?.[0]?.href;
      if (!logo) continue;
      for (const n of [team?.displayName, team?.shortDisplayName, team?.name, team?.location]) if (n) map.set(normName(String(n)), String(logo));
    }
  }
  return map;
}

const ALIASES: Record<string, string> = {
  'inter milan': 'inter',
  internazionale: 'inter',
  'bayern munich': 'bayern munchen',
  'paris saint germain': 'paris saint germain',
  paris: 'paris saint germain',
  'sporting cp': 'sporting cp',
  sporting: 'sporting cp',
  'bayer leverkusen': 'bayer 04 leverkusen',
  'atletico madrid': 'atletico madrid',
  milan: 'milan',
  'psv eindhoven': 'psv eindhoven',
  psv: 'psv eindhoven',
  'real betis': 'real betis',
  betis: 'real betis',
};

/** Logo untuk satu klub: cocok persis, lalu alias, lalu "salah satu memuat yang lain" (minimal 5 huruf). */
export function logoFor(name: string, map: Map<string, string>): string | null {
  const n = normName(name);
  const direct = map.get(n) ?? map.get(ALIASES[n] ?? '');
  if (direct) return direct;
  if (n.length < 5) return null;
  for (const [k, v] of map) if (k.length >= 5 && (k.includes(n) || n.includes(k))) return v;
  return null;
}

/* ---------- susunan tampilan ---------- */

/** Daftar klub → 10 besar + Juventus + klub Italia teratas. `logos` mengisi logo yang belum ada dari sumber. */
export function buildPeringkat(
  rows: ClubRank[],
  opts: { source: 'uefa' | 'wikipedia'; asOf: string | null; logos?: Map<string, string>; now?: Date; warnings?: string[] }
): PeringkatResponse {
  const logos = opts.logos ?? new Map<string, string>();
  const withLogo = rows.map((r) => ({ ...r, logo: r.logo ?? logoFor(r.name, logos) }));
  const juve = withLogo.find((r) => isJuventus(r.name)) ?? null;
  const warnings = [...(opts.warnings ?? [])];
  if (!juve) warnings.push(`Juventus tidak ada di daftar sumber (${withLogo.length} klub teratas); peringkatnya belum bisa ditampilkan.`);
  return {
    top: withLogo.filter((r) => r.rank <= 10).slice(0, 10),
    juve,
    italy: withLogo.find((r) => r.country === 'ITA') ?? null,
    listed: withLogo.length,
    source: opts.source,
    asOf: opts.asOf,
    window: seasonWindow(opts.now),
    warnings,
    updatedAt: new Date().toISOString(),
  };
}
