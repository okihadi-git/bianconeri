// Berita Juventus dari RSS (Google News, tanpa kunci API) + pengayaan lokal:
//   - kategori & label keandalan: aturan kata kunci + daftar sumber (PERKIRAAN, bukan verifikasi fakta)
//   - gambar: foto pemain skuad dari FotMob, logo klub dari ESPN; selain itu inisial / ikon kategori
// Yang diambil hanya judul, sumber, waktu, dan tautan — isi artikel tidak disalin.
// Google News RSS tidak resmi (tanpa dokumentasi/ketentuan), formatnya bisa berubah sewaktu-waktu.
import { ESPN_BASE, JUVE_ID } from './espn';
import { fetchFotmob } from './squad';
import type { NewsCategory, NewsEntity, NewsItem, NewsReliability, NewsResponse } from './news-types';

/* ---------- konfigurasi (silakan diubah) ---------- */

const EN = { hl: 'en-GB', gl: 'GB', ceid: 'GB:en' };
const ID = { hl: 'id', gl: 'ID', ceid: 'ID:id' };

export const FEEDS = [
  { id: 'id-umum', q: 'Juventus when:3d', ...ID },
  { id: 'id-transfer', q: 'Juventus transfer when:7d', ...ID },
  { id: 'id-cedera', q: 'Juventus cedera when:7d', ...ID },
  { id: 'en-umum', q: 'Juventus when:3d', ...EN },
  { id: 'en-transfer', q: 'Juventus transfer OR signing OR loan when:7d', ...EN },
  { id: 'en-injury', q: 'Juventus injury OR injured when:7d', ...EN },
];

/** Sumber resmi: berita dari domain ini diberi label "Resmi". */
const OFFICIAL = ['juventus.com', 'legaseriea.it', 'uefa.com', 'fifa.com', 'figc.it'];

/** Media yang dianggap kredibel: berita dari domain ini (tanpa kata rumor) diberi label "Kuat". */
const TRUSTED = [
  'skysports.com', 'bbc.com', 'bbc.co.uk', 'reuters.com', 'theguardian.com', 'espn.com', 'espn.co.uk', 'goal.com',
  'football-italia.com', 'gazzetta.it', 'tuttosport.com', 'corrieredellosport.it', 'theathletic.com', 'nytimes.com',
  'dazn.com', 'apnews.com', 'bola.com', 'kompas.com', 'cnnindonesia.com', 'detik.com', 'antaranews.com',
  'transfermarkt.com', 'transfermarkt.co.id',
];

const MAX_AGE_DAYS = 7;
const MAX_ITEMS = 60;
const REVALIDATE = 1200; // 20 menit

/* ---------- helper teks ---------- */

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, e: string) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      }
      return ENT[e.toLowerCase()] ?? '';
    });

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
};
const domainIn = (list: string[], host: string) => list.some((d) => host === d || host.endsWith(`.${d}`));

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const initialsOf = (name: string) => {
  const t = name.trim().split(/\s+/).filter(Boolean);
  if (!t.length) return '?';
  return (t.length === 1 ? t[0].slice(0, 2) : t[0][0] + t[t.length - 1][0]).toUpperCase();
};

/* ---------- parser RSS ---------- */

export interface RawItem {
  title: string;
  link: string;
  source: string;
  host: string;
  iso: string;
}

const tagText = (block: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return m ? decode(m[1]).trim() : null;
};

export function parseRss(xml: string): RawItem[] {
  const out: RawItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1];
    let title = tagText(block, 'title');
    const link = tagText(block, 'link');
    const pub = tagText(block, 'pubDate');
    if (!title || !link || !pub) continue;
    const date = new Date(pub);
    if (Number.isNaN(date.getTime())) continue;
    const srcMatch = /<source\s[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/i.exec(block);
    const source = srcMatch ? decode(srcMatch[2]).trim() : '';
    const host = hostOf(srcMatch ? decode(srcMatch[1]) : null);
    // Google menambahkan " - Nama Sumber" di ujung judul
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    else if (!source) title = title.replace(/\s+-\s+[^-]{2,40}$/, '');
    out.push({ title: title.trim(), link, source: source || host || 'Sumber tidak diketahui', host, iso: date.toISOString() });
  }
  return out;
}

/* ---------- kategori & keandalan ---------- */

const CEDERA = /\b(cedera|cidera|injur\w*|absen|diragukan|doubt\w*|sidelined|ruled out|pulih|recover\w*|operasi|surgery|infortun\w*|lesion\w*|fit)\b/;
const KONTRAK = /\b(kontrak|perpanjang\w*|extend\w*|extension|contract|renew\w*|rinnov\w*|klausul\w*|clause|gaji|salary|wages?)\b/;
const TRANSFER = /\b(transfer|bursa|mercato|trattativ\w*|bid|bids|offer\w*|tawar\w*|tawaran|bidik\w*|incar\w*|boyong\w*|rekrut\w*|signing|signs?|signed|loan|pinjam\w*|dipinjamkan|jual|dijual|beli|dibeli|swap|tukar|buyout|here we go|cessione|acquist\w*)\b/;
const RUMOR = /\b(rumor|rumour|gosip|dikabarkan|disebut|diklaim|katanya|bisa jadi|could|might|eyeing|eyes|interest\w*|tertarik|linked|link\w*|target\w*|idea|sogno|pista|nel mirino|monitor\w*|considering|pertimbang\w*|apakah|kabar)\b/;

export function categorize(title: string): NewsCategory {
  const t = norm(title);
  if (CEDERA.test(t)) return 'cedera';
  if (KONTRAK.test(t)) return 'kontrak';
  if (TRANSFER.test(t)) return 'transfer';
  return 'tim';
}

export function reliabilityOf(title: string, host: string, category: NewsCategory): NewsReliability | null {
  if (domainIn(OFFICIAL, host)) return 'resmi';
  const t = norm(title);
  const rumorish = RUMOR.test(t) || title.includes('?');
  const trusted = domainIn(TRUSTED, host);
  if ((category === 'transfer' || category === 'kontrak') && (rumorish || !trusted)) return 'rumor';
  if (trusted && !rumorish) return 'kuat';
  return null;
}

/* ---------- pengenalan pemain & klub di judul ---------- */

export interface PlayerRef {
  name: string;
  photo: string;
}
export interface ClubRef {
  name: string;
  logo: string;
  aliases: string[];
}

// Nama belakang yang juga nama depan/umum: hanya cocok bila nama lengkapnya muncul
const AMBIGUOUS_LAST = new Set(['david', 'young', 'kelly', 'miller', 'hill', 'allen', 'thomas', 'jones', 'adams']);
const GENERIC_CLUB_WORDS = new Set(['united', 'city', 'real', 'club', 'sporting', 'athletic', 'town', 'rovers']);
const CLUB_ALIASES: Record<string, string> = {
  'man utd': 'manchester united', 'man united': 'manchester united', 'man city': 'manchester city',
  spurs: 'tottenham hotspur', psg: 'paris saint germain', barca: 'barcelona', atletico: 'atletico madrid',
  bayern: 'bayern munich', milan: 'ac milan',
};

/** Cari " frasa " di teks kerja; bila ketemu, tandai bagian itu supaya frasa lebih pendek tidak ikut cocok di dalamnya. */
function take(work: { text: string }, phrase: string): number {
  if (!phrase) return -1;
  const pos = work.text.indexOf(` ${phrase} `);
  if (pos < 0) return -1;
  work.text = work.text.slice(0, pos + 1) + '_'.repeat(phrase.length) + work.text.slice(pos + 1 + phrase.length);
  return pos;
}

export function matchEntities(title: string, players: PlayerRef[], clubs: ClubRef[]): NewsEntity[] {
  const work = { text: ` ${norm(title)} ` };
  const found: { pos: number; ent: NewsEntity }[] = [];

  // Pemain: nama lengkap dulu, baru nama belakang
  const seenPlayers = new Set<string>();
  const addPlayer = (p: PlayerRef, pos: number) => {
    if (pos >= 0 && !seenPlayers.has(p.name)) {
      seenPlayers.add(p.name);
      found.push({ pos, ent: { kind: 'player', name: p.name, image: p.photo || null, initials: initialsOf(p.name) } });
    }
  };
  for (const p of players) addPlayer(p, take(work, norm(p.name)));
  for (const p of players) {
    if (seenPlayers.has(p.name)) continue;
    const last = norm(p.name).split(' ').at(-1) ?? '';
    if (last.length >= 4 && !AMBIGUOUS_LAST.has(last)) addPlayer(p, take(work, last));
  }
  found.sort((a, b) => a.pos - b.pos);
  const ents = found.slice(0, 2).map((f) => f.ent);

  if (ents.length < 2) {
    // Klub: alias terpanjang dulu ("inter milan" sebelum "milan")
    const flat = clubs.flatMap((c) => c.aliases.map((alias) => ({ c, alias }))).sort((a, b) => b.alias.length - a.alias.length);
    const seen = new Set<string>();
    const hits: { pos: number; ent: NewsEntity }[] = [];
    for (const { c, alias } of flat) {
      if (seen.has(c.name)) continue;
      const pos = take(work, alias);
      if (pos >= 0) {
        seen.add(c.name);
        hits.push({ pos, ent: { kind: 'club', name: c.name, image: c.logo || null, initials: initialsOf(c.name) } });
      }
    }
    hits.sort((a, b) => a.pos - b.pos);
    for (const h of hits) if (ents.length < 2) ents.push(h.ent);
  }
  return ents;
}

/* ---------- gabungkan, bersihkan, urutkan ---------- */

const tokens = (title: string) => new Set(norm(title).split(' ').filter((w) => w.length >= 3));
function similar(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return false;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter) >= 0.6;
}

const JUVE_TITLE = /juve|bianconer|vecchia signora/;

export function buildNews(raw: RawItem[], players: PlayerRef[], clubs: ClubRef[], now = new Date()): NewsItem[] {
  const cutoff = now.getTime() - MAX_AGE_DAYS * 86400_000;
  const fresh = raw.filter((r) => new Date(r.iso).getTime() >= cutoff && new Date(r.iso).getTime() <= now.getTime() + 3600_000);

  // Sumber tepercaya & terbaru diproses lebih dulu supaya duplikat yang dibuang adalah versi yang lebih lemah
  const ordered = [...fresh].sort(
    (a, b) =>
      Number(domainIn(OFFICIAL, b.host)) - Number(domainIn(OFFICIAL, a.host)) ||
      Number(domainIn(TRUSTED, b.host)) - Number(domainIn(TRUSTED, a.host)) ||
      b.iso.localeCompare(a.iso),
  );

  const kept: { item: NewsItem; tok: Set<string> }[] = [];
  const seenLinks = new Set<string>();
  for (const r of ordered) {
    if (seenLinks.has(r.link)) continue;
    const tok = tokens(r.title);
    if (kept.some((k) => similar(k.tok, tok))) continue;
    const entities = matchEntities(r.title, players, clubs);
    if (!JUVE_TITLE.test(norm(r.title)) && !entities.some((e) => e.kind === 'player')) continue; // bukan soal Juventus
    const category = categorize(r.title);
    seenLinks.add(r.link);
    kept.push({
      tok,
      item: {
        id: hash(r.link),
        title: r.title,
        url: r.link,
        source: r.source,
        iso: r.iso,
        category,
        reliability: reliabilityOf(r.title, r.host, category),
        entities,
      },
    });
  }
  return kept
    .map((k) => k.item)
    .sort((a, b) => b.iso.localeCompare(a.iso))
    .slice(0, MAX_ITEMS);
}

/* ---------- pengambilan data ---------- */

const UA = 'Mozilla/5.0 (compatible; bianconeri-matchday-hub)';

async function loadFeed(feed: (typeof FEEDS)[number]): Promise<RawItem[]> {
  const url =
    'https://news.google.com/rss/search?' +
    new URLSearchParams({ q: feed.q, hl: feed.hl, gl: feed.gl, ceid: feed.ceid });
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, text/xml' }, next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const items = parseRss(await res.text());
  return items;
}

const LOGO_LEAGUES = ['ita.1', 'eng.1', 'esp.1', 'ger.1', 'fra.1', 'uefa.champions', 'uefa.europa'];

async function loadClubs(errors: Record<string, string>): Promise<ClubRef[]> {
  const settled = await Promise.allSettled(
    LOGO_LEAGUES.map(async (slug) => {
      const res = await fetch(`${ESPN_BASE}/v2/sports/soccer/${slug}/standings`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entries: any[] = data?.children?.flatMap((g: any) => g?.standings?.entries ?? []) ?? data?.standings?.entries ?? [];
      return entries.map((e) => e?.team).filter(Boolean);
    }),
  );
  const byId = new Map<string, any>();
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') s.value.forEach((t: any) => byId.set(String(t.id), t));
    else errors[`logo:${LOGO_LEAGUES[i]}`] = String(s.reason?.message ?? s.reason);
  });

  const clubs: ClubRef[] = [];
  const byName = new Map<string, ClubRef>();
  for (const [id, t] of byId) {
    if (id === JUVE_ID) continue;
    const name = String(t.displayName ?? t.name ?? '');
    const logo = String(t.logos?.[0]?.href ?? '');
    if (!name || !logo) continue;
    const aliases = [...new Set([t.displayName, t.shortDisplayName, t.name].filter(Boolean).map((x: string) => norm(x)))].filter(
      (a) => a.length >= 4 && !GENERIC_CLUB_WORDS.has(a) && a !== 'juventus',
    );
    const ref = { name, logo, aliases };
    clubs.push(ref);
    byName.set(norm(name), ref);
  }
  for (const [alias, target] of Object.entries(CLUB_ALIASES)) byName.get(target)?.aliases.push(alias);
  return clubs;
}

export async function fetchNews(): Promise<NewsResponse> {
  const errors: Record<string, string> = {};

  const [feeds, players, clubs] = await Promise.all([
    Promise.allSettled(FEEDS.map(loadFeed)),
    fetchFotmob()
      .then((s) => s.players.map((p) => ({ name: p.name, photo: p.photo })))
      .catch((e) => {
        errors.skuad = String(e?.message ?? e);
        return [] as PlayerRef[];
      }),
    loadClubs(errors),
  ]);

  const raw: RawItem[] = [];
  feeds.forEach((f, i) => {
    if (f.status === 'fulfilled') raw.push(...f.value);
    else errors[`rss:${FEEDS[i].id}`] = String(f.reason?.message ?? f.reason);
  });

  if (!raw.length && Object.keys(errors).some((k) => k.startsWith('rss:'))) {
    throw Object.assign(new Error('Semua umpan berita gagal dimuat'), { errors });
  }

  return { items: buildNews(raw, players, clubs), updatedAt: new Date().toISOString(), errors };
}
