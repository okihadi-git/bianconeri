// Data halaman Klub dari API gratis tanpa kunci:
//   1. Wikipedia (id lebih dulu, lalu en) — narasi sejarah, dipecah per era dari judul seksi
//   2. Wikidata — tahun berdiri, kandang (+kapasitas), pemilik
//   3. Wikimedia Commons — foto + penulis + lisensi (hanya bila ClubConfig.photo diisi)
// Tidak ada data yang dikarang: kalau sumber tidak punya nilainya, field-nya null.
// Teks Wikipedia berlisensi CC BY-SA 4.0 — halaman wajib menampilkan atribusi dan tautan artikel.
import type { ClubConfig } from './clubs';
import type { KlubCard, KlubEra, KlubPhoto, KlubResponse } from './types';

const CONTACT = process.env.WIKI_CONTACT || 'https://github.com/';
const UA = `bianconeri-matchday-hub/1.0 (fan project; ${CONTACT})`;
const REVALIDATE = 86400; // sejarah klub jarang berubah

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    next: { revalidate: REVALIDATE },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

const wikipedia = (lang: string, params: Record<string, string>) =>
  `https://${lang}.wikipedia.org/w/api.php?` +
  new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', ...params });

/* ---------- Wikipedia: narasi ---------- */

interface Article {
  title: string;
  url: string;
  text: string;
}

async function fetchArticle(lang: 'id' | 'en', title: string): Promise<Article> {
  const body = await getJson(
    wikipedia(lang, { titles: title, prop: 'extracts|info', explaintext: '1', exsectionformat: 'wiki', inprop: 'url' }),
  );
  const page = body?.query?.pages?.[0];
  if (!page || page.missing) throw new Error(`artikel tidak ada: ${lang}:${title}`);
  return { title: String(page.title), url: String(page.fullurl), text: String(page.extract ?? '') };
}

async function fetchWikidataId(title: string): Promise<string | null> {
  const body = await getJson(wikipedia('en', { titles: title, prop: 'pageprops', ppprop: 'wikibase_item' }));
  return body?.query?.pages?.[0]?.pageprops?.wikibase_item ?? null;
}

interface Section {
  level: number;
  title: string;
  body: string;
}

/** Teks polos dengan penanda "== Judul ==" dipecah menjadi daftar seksi (datar). */
export function parseSections(text: string): Section[] {
  const re = /^(={2,6})\s*(.+?)\s*\1\s*$/gm;
  const marks: { level: number; title: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) marks.push({ level: m[1].length, title: m[2], start: m.index, end: re.lastIndex });
  return marks.map((mk, i) => ({
    level: mk.level,
    title: mk.title,
    body: text.slice(mk.end, marks[i + 1]?.start ?? text.length).trim(),
  }));
}

const NOT_HISTORY = /^(see also|references|notes|footnotes|external links|sources|bibliography|further reading|lihat pula|referensi|catatan|pranala luar|bacaan lanjutan|daftar pustaka|rujukan|sumber)\b/i;
const HISTORY_HEADING = /^(sejarah|history)\b/i;

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

/** Buang catatan kaki [1], [a], [citation needed], rapikan spasi, ambil paragraf berisi saja. */
export function cleanParagraphs(body: string, maxParas = 2, maxChars = 700): string[] {
  return body
    .split(/\n+/)
    .map((p) =>
      p
        .replace(/\[(?:\d+|[a-z]|citation needed|butuh rujukan|rujukan|note \d+)\]/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:])/g, '$1')
        .trim(),
    )
    .filter((p) => p.length >= 60 && !/^[*|•]/.test(p))
    .slice(0, maxParas)
    .map((p) => clip(p, maxChars));
}

/** "Founding and early years (1897–1923)" -> { title, span } */
function splitSpan(raw: string): { title: string; span: string | null } {
  const m = /\s*\((?:c\.\s*|sekitar\s*)?(\d{3,4}\s*[–—-]\s*(?:\d{3,4}|present|sekarang|kini))\)\s*$/i.exec(raw);
  if (!m) return { title: raw.trim(), span: null };
  return { title: raw.slice(0, m.index).trim(), span: m[1].replace(/\s*[—-]\s*/, '–').replace(/\s+/g, ' ') };
}

/** Pilih era dari satu artikel. Mengembalikan [] bila tidak ada bagian sejarah yang bisa dipakai. */
export function pickEras(article: Article, max = 8): KlubEra[] {
  const sections = parseSections(article.text);
  const histIdx = sections.findIndex((s) => s.level === 2 && HISTORY_HEADING.test(s.title));
  let picked: Section[] = [];

  if (histIdx >= 0) {
    // Artikel utama klub: seksi "Sejarah"/"History" dan anak-anaknya
    const parent = sections[histIdx];
    const kids: Section[] = [];
    for (let i = histIdx + 1; i < sections.length && sections[i].level > 2; i++) kids.push(sections[i]);
    picked = kids.length ? kids : [parent];
    if (kids.length && parent.body.length >= 200) picked = [{ ...parent, title: 'Gambaran umum' }, ...kids];
  } else if (/^(history of|sejarah)\b/i.test(article.title)) {
    // Artikel khusus sejarah: tiap seksi level-2 adalah satu era
    picked = sections.filter((s) => s.level === 2 && !NOT_HISTORY.test(s.title));
  }

  const eras: KlubEra[] = [];
  for (const s of picked) {
    const paragraphs = cleanParagraphs(s.body);
    if (!paragraphs.length) continue;
    const { title, span } = splitSpan(s.title);
    eras.push({ title, span, paragraphs });
    if (eras.length >= max) break;
  }
  return eras;
}

const totalChars = (eras: KlubEra[]) => eras.reduce((n, e) => n + e.paragraphs.join('').length, 0);

/* ---------- Wikidata: kartu ringkas ---------- */

async function wikidata(ids: string[]): Promise<Record<string, any>> {
  const url =
    'https://www.wikidata.org/w/api.php?' +
    new URLSearchParams({
      action: 'wbgetentities',
      format: 'json',
      ids: ids.join('|'),
      props: 'labels|claims',
      languages: 'id|en',
      languagefallback: '1',
    });
  const body = await getJson(url);
  if (body?.error) throw new Error(`wikidata: ${body.error.info ?? body.error.code}`);
  return body?.entities ?? {};
}

const claimsOf = (entity: any, prop: string): any[] => entity?.claims?.[prop] ?? [];

/** Pernyataan yang masih berlaku (tanpa tanggal berakhir), diutamakan yang berperingkat "preferred". */
function current(claims: any[]): any[] {
  const live = claims.filter((c) => c.rank !== 'deprecated' && c.mainsnak?.datavalue);
  const open = live.filter((c) => !c.qualifiers?.P582);
  const pool = open.length ? open : live;
  const preferred = pool.filter((c) => c.rank === 'preferred');
  return preferred.length ? preferred : pool;
}

const entityId = (c: any): string | undefined => c?.mainsnak?.datavalue?.value?.id;
const label = (e: any): string | null => e?.labels?.id?.value ?? e?.labels?.en?.value ?? null;

function yearOf(snak: any): string | null {
  const t = snak?.datavalue?.value?.time;
  const m = typeof t === 'string' ? /^[+-]?(\d+)-/.exec(t) : null;
  return m ? String(Number(m[1])) : null;
}

const amountOf = (snak: any): number | null => {
  const n = Number(snak?.datavalue?.value?.amount);
  return Number.isFinite(n) ? n : null;
};

const fmtInt = (n: number) => new Intl.NumberFormat('id-ID').format(n);

async function fetchCards(qid: string, cfg: ClubConfig): Promise<KlubCard[]> {
  const club = (await wikidata([qid]))[qid];
  if (!club) throw new Error(`entitas Wikidata ${qid} tidak ditemukan`);

  const founded = current(claimsOf(club, 'P571'))[0];
  const foundedYear = yearOf(founded?.mainsnak);

  // Kandang: yang terbaru bila ada beberapa yang masih berlaku
  const venues = current(claimsOf(club, 'P115')).sort(
    (a, b) => Number(yearOf(b.qualifiers?.P580?.[0]) ?? 0) - Number(yearOf(a.qualifiers?.P580?.[0]) ?? 0),
  );
  const venue = venues[0];
  const venueId = entityId(venue);

  // Pemilik: porsi kepemilikan (P1107) terbesar dulu
  const owners = current(claimsOf(club, 'P127')).sort(
    (a, b) => (amountOf(b.qualifiers?.P1107?.[0]) ?? 0) - (amountOf(a.qualifiers?.P1107?.[0]) ?? 0),
  );
  const ownerId = entityId(owners[0]);

  const ids = [venueId, ownerId].filter((x): x is string => Boolean(x));
  const related = ids.length ? await wikidata([...new Set(ids)]) : {};

  const venueEntity = venueId ? related[venueId] : null;
  const capacity = amountOf(current(claimsOf(venueEntity, 'P1083'))[0]?.mainsnak);
  const since = yearOf(venue?.qualifiers?.P580?.[0]) ?? yearOf(claimsOf(venueEntity, 'P1619')[0]?.mainsnak);

  const venueSub = [since ? `Sejak ${since}` : '', capacity ? `kapasitas ${fmtInt(capacity)}` : ''].filter(Boolean).join(' · ');

  return [
    { label: 'Berdiri', value: foundedYear, sub: cfg.foundedNote },
    { label: 'Kandang', value: label(venueEntity), sub: venueSub || null },
    { label: 'Pemilik', value: ownerId ? label(related[ownerId]) : null, sub: cfg.ownerNote },
    { label: cfg.tier.label, value: cfg.tier.value, sub: cfg.tier.sub },
  ];
}

const baseCards = (cfg: ClubConfig): KlubCard[] => [
  { label: 'Berdiri', value: null, sub: cfg.foundedNote },
  { label: 'Kandang', value: null, sub: null },
  { label: 'Pemilik', value: null, sub: cfg.ownerNote },
  { label: cfg.tier.label, value: cfg.tier.value, sub: cfg.tier.sub },
];

/* ---------- Commons: foto ---------- */

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
const plain = (s?: string | null): string | null => {
  if (!s) return null;
  const t = s.replace(/<[^>]*>/g, '').replace(/&(?:amp|quot|#39|lt|gt|nbsp);/g, (e) => ENTITIES[e]).replace(/\s+/g, ' ').trim();
  return t || null;
};

async function fetchPhoto(file: string, caption: string): Promise<KlubPhoto | null> {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      titles: file,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|size',
      iiurlwidth: '900',
      iiextmetadatafilter: 'Artist|LicenseShortName',
    });
  const info = (await getJson(url))?.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) throw new Error(`berkas tidak ditemukan di Commons: ${file}`);
  return {
    url: String(info.thumburl ?? info.url),
    width: info.thumbwidth ?? null,
    height: info.thumbheight ?? null,
    caption,
    credit: plain(info.extmetadata?.Artist?.value),
    license: plain(info.extmetadata?.LicenseShortName?.value),
    pageUrl: info.descriptionurl ?? null,
  };
}

/* ---------- gabungan ---------- */

export async function fetchKlub(cfg: ClubConfig): Promise<KlubResponse> {
  const errors: Record<string, string> = {};
  const fail = (key: string) => (e: any) => {
    errors[key] = String(e?.message ?? e);
    console.warn(`[klub] ${key} gagal:`, errors[key]);
    return null;
  };

  // Semua sumber diminta bersamaan supaya tidak saling menambah waktu tunggu
  const cardsP = fetchWikidataId(cfg.wikiMain)
    .then((qid) => {
      if (!qid) throw new Error(`ID Wikidata untuk ${cfg.wikiMain} tidak ditemukan`);
      return fetchCards(qid, cfg);
    })
    .catch(fail('wikidata'));
  const photoP = cfg.photo ? fetchPhoto(cfg.photo.file, cfg.photo.caption).catch(fail('foto')) : Promise.resolve(null);

  // Narasi: bahasa Indonesia dulu; pindah ke Inggris bila bagian sejarahnya tak ada / terlalu pendek
  let eras: KlubEra[] = [];
  let source: KlubResponse['source'] = null;
  for (const lang of ['id', 'en'] as const) {
    for (const title of cfg.history[lang]) {
      try {
        const article = await fetchArticle(lang, title);
        const found = pickEras(article);
        if (totalChars(found) >= 500) {
          eras = found;
          source = { lang, url: article.url, title: article.title };
          break;
        }
        errors[`${lang}:${title}`] = 'bagian sejarah tidak ditemukan atau terlalu pendek';
      } catch (e: any) {
        errors[`${lang}:${title}`] = String(e?.message ?? e);
      }
    }
    if (source) break;
  }

  return {
    club: cfg.slug,
    name: cfg.name,
    cards: (await cardsP) ?? baseCards(cfg),
    eras,
    photo: await photoP,
    timeline: cfg.timeline,
    source,
    updatedAt: new Date().toISOString(),
    errors,
  };
}
