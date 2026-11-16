// Riwayat pelatih kepala dari Wikipedia (API MediaWiki, gratis, tanpa kunci):
//   - tabel daftar pelatih (nama, negara, tahun, jumlah laga/menang) dan tabel jumlah trofi per pelatih
//   - foto kecil dari artikel Wikipedia masing-masing pelatih (pageimages)
// Tidak ada data yang dikarang: bila tabel tidak bisa dibaca, daftar kosong dan alasannya ada di `errors`.
// Teks Wikipedia berlisensi CC BY-SA 4.0 — halaman wajib menampilkan atribusi.
import type { CoachSource } from './coach-config';
import type { CoachHonour, CoachNation, CoachesResponse, ManagerRow, StaffMember } from './coaches-types';

const UA = `bianconeri-matchday-hub/1.0 (fan project; ${process.env.WIKI_CONTACT || 'https://github.com/'})`;
const REVALIDATE = 86400;

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    next: { revalidate: REVALIDATE },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).host}`);
  return res.json();
}

/* ---------- negara (kode FIFA -> nama Indonesia + bendera) ---------- */

// [nama Indonesia, kode bendera flagcdn | null]
const COUNTRIES: Record<string, [string, string | null]> = {
  ITA: ['Italia', 'it'], HUN: ['Hongaria', 'hu'], SCO: ['Skotlandia', 'gb-sct'], ENG: ['Inggris', 'gb-eng'],
  WAL: ['Wales', 'gb-wls'], NIR: ['Irlandia Utara', 'gb-nir'], IRL: ['Irlandia', 'ie'], YUG: ['Yugoslavia', null],
  TCH: ['Cekoslovakia', null], BRA: ['Brasil', 'br'], PAR: ['Paraguay', 'py'], ARG: ['Argentina', 'ar'],
  URU: ['Uruguay', 'uy'], CHI: ['Cile', 'cl'], COL: ['Kolombia', 'co'], MEX: ['Meksiko', 'mx'], USA: ['Amerika Serikat', 'us'],
  FRA: ['Prancis', 'fr'], ESP: ['Spanyol', 'es'], POR: ['Portugal', 'pt'], GER: ['Jerman', 'de'], NED: ['Belanda', 'nl'],
  BEL: ['Belgia', 'be'], SUI: ['Swiss', 'ch'], AUT: ['Austria', 'at'], CZE: ['Ceko', 'cz'], SVK: ['Slovakia', 'sk'],
  POL: ['Polandia', 'pl'], ROU: ['Rumania', 'ro'], SRB: ['Serbia', 'rs'], CRO: ['Kroasia', 'hr'], SVN: ['Slovenia', 'si'],
  BIH: ['Bosnia dan Herzegovina', 'ba'], MNE: ['Montenegro', 'me'], GRE: ['Yunani', 'gr'], TUR: ['Turki', 'tr'],
  RUS: ['Rusia', 'ru'], UKR: ['Ukraina', 'ua'], SWE: ['Swedia', 'se'], DEN: ['Denmark', 'dk'], NOR: ['Norwegia', 'no'],
  FIN: ['Finlandia', 'fi'], JPN: ['Jepang', 'jp'], KOR: ['Korea Selatan', 'kr'], AUS: ['Australia', 'au'],
  SEN: ['Senegal', 'sn'], CIV: ['Pantai Gading', 'ci'], NGA: ['Nigeria', 'ng'], GHA: ['Ghana', 'gh'], MAR: ['Maroko', 'ma'],
};

export function nationOf(code: string): CoachNation {
  const hit = COUNTRIES[code.toUpperCase()];
  if (!hit) return { code, name: code, flag: null };
  return { code, name: hit[0], flag: hit[1] ? `https://flagcdn.com/w40/${hit[1]}.png` : null };
}

/* ---------- pembaca HTML tabel (tanpa dependensi) ---------- */

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—' };
function decodeHtml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** HTML sel -> teks polos; baris baru dipertahankan dari <br>/<li>/<p>. Catatan kaki [1] dan teks tersembunyi dibuang. */
export function cellText(html: string): string {
  return decodeHtml(
    html
      .replace(/<sup[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '')
      .replace(/<span[^>]*display:\s*none[^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>|<\/(?:li|p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

interface Cell {
  html: string;
  text: string;
}

export function parseTables(html: string): Cell[][][] {
  const tables: Cell[][][] = [];
  const tre = /<table\b[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tre.exec(html))) {
    const rows: Cell[][] = [];
    const rre = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = rre.exec(tm[1]))) {
      const cells: Cell[] = [];
      const cre = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = cre.exec(rm[1]))) cells.push({ html: cm[2], text: cellText(cm[2]) });
      if (cells.length) rows.push(cells);
    }
    tables.push(rows);
  }
  return tables;
}

/** Tautan artikel Wikipedia terakhir di dalam sel (nama muncul setelah ikon bendera). */
function articleLink(cell: Cell): { title: string; text: string } | null {
  let found: { title: string; text: string } | null = null;
  const re = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cell.html))) {
    const href = decodeHtml(m[1]);
    const text = cellText(m[2]).replace(/\n/g, ' ');
    if (!href.startsWith('/wiki/') || /^\/wiki\/(?:File|Special|Help|Wikipedia|Template|Category|Talk):/i.test(href) || text.length < 2) continue;
    let title = href.slice('/wiki/'.length).split('#')[0];
    try {
      title = decodeURIComponent(title);
    } catch {
      /* biarkan apa adanya */
    }
    found = { title: title.replace(/_/g, ' '), text };
  }
  return found;
}

/* ---------- daftar pelatih ---------- */

const HONOUR_LABELS: [string, string][] = [
  ['SA', 'Scudetto'],
  ['CI', 'Coppa Italia'],
  ['SCI', 'Supercoppa Italiana'],
  ['UCL', 'Liga Champions'],
  ['CWC', 'Piala Winners UEFA'],
  ['UEL', 'Piala UEFA'],
  ['USC', 'Piala Super UEFA'],
  ['UIC', 'Piala Intertoto'],
  ['IC', 'Piala Interkontinental'],
];

const num = (s: string | undefined) => {
  const n = parseInt((s ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

interface Stint {
  year: number;
  interim: boolean;
}

/** "1959 1961 1974" / "1926(int.)" -> daftar tahun + penanda sementara */
function parseFroms(text: string): Stint[] {
  const out: Stint[] = [];
  for (const tok of text.replace(/\s*\(int\.\)/gi, '(int.)').split(/\s+/)) {
    const m = /^(\d{4})(\(int\.\))?$/.exec(tok);
    if (m) out.push({ year: Number(m[1]), interim: Boolean(m[2]) });
  }
  return out;
}

/** token "To": tahun, atau null untuk tanda strip (masih menjabat / tidak diketahui) */
const parseTos = (text: string): (number | null)[] =>
  text.split(/\s+/).filter(Boolean).map((t) => (/^\d{4}/.test(t) ? Number(t.slice(0, 4)) : null));

export function periodOf(froms: number[], tos: (number | null)[]): { period: string; current: boolean } {
  if (!froms.length) return { period: '–', current: false };
  const lastOpen = tos.length > 0 && tos[tos.length - 1] === null;
  const midOpen = tos.slice(0, -1).some((t) => t === null);
  if (tos.length === froms.length && !midOpen) {
    const parts = froms.map((y, i) => {
      const t = tos[i];
      if (t === null) return `${y}–sekarang`;
      return y === t ? `${y}` : `${y}–${t}`;
    });
    return { period: parts.join(' · '), current: lastOpen };
  }
  // Susunan tidak rapi (mis. dua masa jabatan dengan satu tanda strip): tampilkan rentang terluar saja
  const ends = tos.filter((t): t is number => t !== null);
  const start = Math.min(...froms);
  if (lastOpen && !midOpen) return { period: `${start}–sekarang`, current: true };
  const end = ends.length ? Math.max(...ends) : null;
  return { period: end && end !== start ? `${start}–${end}` : `${start}`, current: false };
}

export interface ParsedList {
  managers: Omit<ManagerRow, 'photo'>[];
  interim: { name: string; year: number }[];
  statsAsOf: string | null;
}

export function parseManagerList(html: string): ParsedList {
  const tables = parseTables(html);
  const head = (t: Cell[][]) => t[0]?.map((c) => c.text.toLowerCase().trim()) ?? [];
  const listT = tables.find((t) => head(t).includes('nat.') && head(t).includes('from') && head(t).includes('to'));
  const honT = tables.find((t) => head(t).includes('manager') && head(t).includes('sa') && head(t).includes('ci'));
  if (!listT) throw new Error('tabel daftar pelatih tidak ditemukan di artikel');

  // jumlah trofi per pelatih: sel pelatih (punya tautan artikel) lalu 9 sel angka SA..IC
  const honours = new Map<string, CoachHonour[]>();
  if (honT) {
    for (const row of honT.slice(1)) {
      const at = row.findIndex((c) => articleLink(c));
      if (at < 0) continue;
      const link = articleLink(row[at])!;
      const list: CoachHonour[] = [];
      HONOUR_LABELS.forEach(([, label], i) => {
        const n = num(row[at + 1 + i]?.text);
        if (n && n > 0) list.push({ label, count: n });
      });
      honours.set(norm(link.title), list);
      honours.set(norm(link.text), list);
    }
  }

  const h = head(listT);
  const col = (name: string) => h.indexOf(name);
  const [cName, cNat, cFrom, cTo, cM, cWp] = ['name', 'nat.', 'from', 'to', 'm', 'w%'].map(col);

  const managers: Omit<ManagerRow, 'photo'>[] = [];
  const interim: { name: string; year: number }[] = [];
  for (const row of listT.slice(1)) {
    if (row.length < Math.max(cName, cNat, cFrom, cTo) + 1) continue;
    const link = articleLink(row[cName]);
    const name = (link?.text ?? row[cName].text).replace(/\s+/g, ' ').trim();
    const stints = parseFroms(row[cFrom].text);
    if (!name || !stints.length) continue;
    if (stints.every((s) => s.interim)) {
      interim.push({ name, year: stints[0].year });
      continue;
    }
    const { period, current } = periodOf(stints.map((s) => s.year), parseTos(row[cTo].text));
    const codes = [...new Set(row[cNat].text.split(/\s+/).filter((c) => /^[A-Z]{3}$/.test(c)))];
    managers.push({
      n: managers.length + 1,
      name,
      wiki: link?.title ?? null,
      nations: codes.map(nationOf),
      period,
      fromYear: Math.min(...stints.map((s) => s.year)),
      current,
      honours: honours.get(norm(link?.title ?? '')) ?? honours.get(norm(name)) ?? [],
      matches: cM >= 0 ? num(row[cM]?.text) : null,
      winPct: cWp >= 0 ? (() => { const v = parseFloat((row[cWp]?.text ?? '').replace(',', '.')); return Number.isFinite(v) ? v : null; })() : null,
    });
  }

  const as = /correct as of (\d{1,2} [A-Za-z]+ \d{4})/i.exec(cellText(html));
  return { managers, interim, statsAsOf: as ? as[1] : null };
}

/* ---------- foto (pageimages) ---------- */

export async function fetchThumbs(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(titles.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 40) {
    const chunk = uniq.slice(i, i + 40);
    const body = await getJson(
      'https://en.wikipedia.org/w/api.php?' +
        new URLSearchParams({
          action: 'query', format: 'json', formatversion: '2', redirects: '1',
          prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '120', pilimit: '50', titles: chunk.join('|'),
        }),
    );
    const q = body?.query ?? {};
    const hop = (arr: any[] | undefined) => new Map<string, string>((arr ?? []).map((x) => [String(x.from), String(x.to)]));
    const normalized = hop(q.normalized);
    const redirects = hop(q.redirects);
    const byTitle = new Map<string, string>();
    for (const p of q.pages ?? []) if (p?.thumbnail?.source) byTitle.set(String(p.title), String(p.thumbnail.source));
    for (const t of chunk) {
      const n = normalized.get(t) ?? t;
      const final = redirects.get(n) ?? n;
      const url = byTitle.get(final);
      if (url) out.set(t, url);
    }
  }
  return out;
}

/* ---------- gabungan ---------- */

export function seasonLabel(now = new Date()): string {
  const y = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 6 ? y : y - 1; // musim baru mulai sekitar Juli
  return `${start}/${String(start + 1).slice(2)}`;
}

const ID_MONTHS: Record<string, string> = {
  January: 'Januari', February: 'Februari', March: 'Maret', April: 'April', May: 'Mei', June: 'Juni', July: 'Juli',
  August: 'Agustus', September: 'September', October: 'Oktober', November: 'November', December: 'Desember',
};
const idDate = (s: string) => s.replace(/[A-Za-z]+/, (m) => ID_MONTHS[m] ?? m);

export async function fetchCoaches(cfg: CoachSource): Promise<CoachesResponse> {
  const errors: Record<string, string> = {};
  let parsed: ParsedList | null = null;
  let source: CoachesResponse['source'] = null;

  try {
    const body = await getJson(
      'https://en.wikipedia.org/w/api.php?' +
        new URLSearchParams({ action: 'parse', format: 'json', formatversion: '2', redirects: '1', prop: 'text', page: cfg.listTitle }),
    );
    const html = body?.parse?.text;
    if (typeof html !== 'string') throw new Error(`artikel tidak ditemukan: ${cfg.listTitle}`);
    parsed = parseManagerList(html);
    source = { title: String(body.parse.title ?? cfg.listTitle), url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(body.parse.title ?? cfg.listTitle).replace(/ /g, '_'))}` };
  } catch (e: any) {
    errors.daftar = String(e?.message ?? e);
    console.warn('[pelatih] daftar gagal:', errors.daftar);
  }

  const wanted = [...(parsed?.managers.map((m) => m.wiki).filter(Boolean) as string[] ?? []), ...cfg.staff.map((s) => s.wiki).filter(Boolean) as string[]];
  let thumbs = new Map<string, string>();
  try {
    thumbs = await fetchThumbs(wanted);
  } catch (e: any) {
    errors.foto = String(e?.message ?? e);
  }

  const managers: ManagerRow[] = (parsed?.managers ?? []).map((m) => ({ ...m, photo: (m.wiki && thumbs.get(m.wiki)) || null }));
  const staff: StaffMember[] = cfg.staff.map((s) => ({
    name: s.name,
    role: s.role,
    nation: nationOf(s.code),
    photo: (s.wiki && thumbs.get(s.wiki)) || null,
  }));

  return {
    club: cfg.slug,
    season: seasonLabel(),
    managers,
    staff,
    staffAsOf: cfg.staffAsOf,
    statsAsOf: parsed?.statsAsOf ? idDate(parsed.statsAsOf) : null,
    interim: parsed?.interim ?? [],
    source,
    updatedAt: new Date().toISOString(),
    errors,
  };
}
