import { NextResponse } from 'next/server';
import { cleanParagraphs } from '@/lib/wiki';
import type { CoachResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const UA = `bianconeri-matchday-hub/1.0 (fan project; ${process.env.WIKI_CONTACT || 'https://github.com/'})`;
// Pagar pengaman: artikel yang ditemukan harus berbicara tentang sepak bola/pelatih,
// supaya nama pelatih yang sama dengan tokoh lain tidak menampilkan orang yang salah.
const FOOTBALL = /football|footballer|soccer|manager|coach|sepak ?bola|pelatih|pemain/i;

async function lookup(lang: 'id' | 'en', name: string): Promise<CoachResponse | null> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?` +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      redirects: '1',
      titles: name,
      prop: 'extracts|pageimages|info|description|pageprops',
      exintro: '1',
      explaintext: '1',
      piprop: 'thumbnail',
      pithumbsize: '480',
      inprop: 'url',
      ppprop: 'disambiguation',
    });
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${lang}.wikipedia.org`);
  const page = (await res.json())?.query?.pages?.[0];
  if (!page || page.missing) return null;
  if (page.pageprops && 'disambiguation' in page.pageprops) return null;

  const extract = String(page.extract ?? '');
  const description = page.description ? String(page.description) : null;
  if (extract.length < 80 || !FOOTBALL.test(`${description ?? ''} ${extract.slice(0, 400)}`)) return null;

  return {
    name,
    title: String(page.title),
    description,
    paragraphs: cleanParagraphs(extract, 3, 600),
    photo: page.thumbnail?.source ? String(page.thumbnail.source) : null,
    url: String(page.fullurl),
    lang,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Profil singkat pelatih dari Wikipedia (id dulu, lalu en). ?name=Nama Pelatih
 * Tidak ada data karangan: kalau artikel tidak ditemukan/tak meyakinkan, balasannya 404.
 */
export async function GET(req: Request) {
  const name = (new URL(req.url).searchParams.get('name') ?? '').trim();
  if (!name || name.length > 80) return NextResponse.json({ error: 'Parameter name tidak valid' }, { status: 400 });

  const errors: Record<string, string> = {};
  for (const lang of ['id', 'en'] as const) {
    try {
      const found = await lookup(lang, name);
      if (found) return NextResponse.json(found, { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' } });
      errors[lang] = 'artikel tidak ditemukan atau bukan tentang pelatih/pemain sepak bola';
    } catch (e: any) {
      errors[lang] = String(e?.message ?? e);
    }
  }
  console.warn('[pelatih] gagal:', name, errors);
  return NextResponse.json({ error: 'Profil pelatih belum ditemukan', errors }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
