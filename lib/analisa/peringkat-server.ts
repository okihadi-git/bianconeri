// Analisa → Peringkat klub (koefisien UEFA). Sumber berurutan: API data UEFA (daftar lengkap) → Wikipedia (25 besar).
// Logo klub dari daftar tim ESPN, dicocokkan lewat nama; tidak cocok = tanpa logo. Semua kegagalan jadi peringatan, bukan error.
import { ESPN_BASE } from '../espn';
import { UA, getJson } from './http';
import { buildPeringkat, logoMap, parseUefaClubs, parseWikiClubs, uefaRankingYear, wikiAsOf, type ClubRank, type PeringkatResponse } from './peringkat';

const REVALIDATE = 6 * 3600; // koefisien berubah setelah tiap putaran Eropa, tidak tiap menit
const get = (url: string, headers: Record<string, string> = {}, revalidate = REVALIDATE) => getJson(url, { headers, revalidate });

export const uefaUrl = (now = new Date()) =>
  `https://comp.uefa.com/v2/coefficients?coefficientRange=OVERALL&coefficientType=MEN_CLUB&language=EN&page=1&pagesize=100&seasonYear=${uefaRankingYear(now)}`;
const UEFA_HEADERS = { Origin: 'https://www.uefa.com', Referer: 'https://www.uefa.com/' };

/** Daftar lengkap dari API UEFA. Dianggap gagal bila bentuknya tidak masuk akal (kurang dari 25 klub atau poin tidak menurun). */
async function fromUefa(): Promise<ClubRank[]> {
  const rows = parseUefaClubs(await get(uefaUrl(), UEFA_HEADERS));
  const sane = rows.length >= 25 && rows[0].rank === 1 && rows.every((r, i) => i === 0 || r.points <= rows[i - 1].points + 0.0001);
  if (!sane) throw new Error(`respons UEFA tidak dikenali (${rows.length} baris)`);
  return rows;
}

const wiki = (params: Record<string, string>) =>
  'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'parse', format: 'json', formatversion: '2', redirects: '1', page: 'UEFA_coefficient', ...params });

/** 25 klub teratas dari bagian "Men's club coefficient" di Wikipedia. */
async function fromWikipedia(): Promise<{ rows: ClubRank[]; asOf: string | null }> {
  const secs: any[] = (await get(wiki({ prop: 'sections' })))?.parse?.sections ?? [];
  const sec = secs.find((s) => s?.anchor === "Men's_club_coefficient" || /^men.s club coefficient$/i.test(String(s?.line ?? '')));
  if (!sec) throw new Error('bagian "Men\'s club coefficient" tidak ditemukan');
  const html = String((await get(wiki({ prop: 'text', section: String(sec.index), disableeditsection: '1' })))?.parse?.text ?? '');
  const rows = parseWikiClubs(html);
  if (rows.length < 10) throw new Error('tabel klub tidak terbaca');
  return { rows, asOf: wikiAsOf(html) };
}

const LOGO_LEAGUES = ['uefa.champions', 'uefa.europa', 'ita.1', 'eng.1', 'esp.1', 'ger.1', 'fra.1', 'por.1', 'ned.1'];
async function fetchLogos() {
  const res = await Promise.allSettled(LOGO_LEAGUES.map((l) => get(`${ESPN_BASE}/site/v2/sports/soccer/${l}/teams?limit=100`, {}, 86400)));
  return logoMap(res.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])));
}

export async function fetchPeringkat(): Promise<PeringkatResponse> {
  const logos = await fetchLogos().catch(() => new Map<string, string>());
  const warnings: string[] = [];
  try {
    return buildPeringkat(await fromUefa(), { source: 'uefa', asOf: null, logos });
  } catch (e) {
    warnings.push(`Data resmi UEFA tidak bisa dimuat (${(e as Error).message}); memakai Wikipedia yang hanya memuat 25 klub teratas.`);
  }
  try {
    const { rows, asOf } = await fromWikipedia();
    return buildPeringkat(rows, { source: 'wikipedia', asOf, logos, warnings });
  } catch (e) {
    warnings.push(`Wikipedia juga gagal (${(e as Error).message}).`);
    return { ...buildPeringkat([], { source: 'wikipedia', asOf: null, warnings }), warnings };
  }
}

/** Diagnosis untuk /api/analisa/peringkat?debug=1: apa yang sebenarnya dikirim tiap sumber. Tanpa cache. */
export async function debugPeringkat() {
  const out: Record<string, unknown> = { uefaUrl: uefaUrl() };
  try {
    const res = await fetch(uefaUrl(), { headers: { Accept: 'application/json', 'User-Agent': UA, ...UEFA_HEADERS }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
    const text = await res.text();
    out.uefaStatus = res.status;
    try {
      const json = JSON.parse(text);
      const list: any[] = json?.data?.members ?? json?.members ?? (Array.isArray(json?.data) ? json.data : []);
      out.uefaTopKeys = Object.keys(json ?? {});
      out.uefaMemberCount = Array.isArray(list) ? list.length : null;
      out.uefaFirstMember = JSON.stringify(list?.[0] ?? null).slice(0, 1500);
      out.uefaParsed = parseUefaClubs(json).slice(0, 3);
    } catch {
      out.uefaBody = text.slice(0, 300);
    }
  } catch (e) {
    out.uefaError = (e as Error).message;
  }
  try {
    const w = await fromWikipedia();
    out.wikipedia = { asOf: w.asOf, rows: w.rows.length, first: w.rows[0], juve: w.rows.find((r) => /juventus/i.test(r.name)) ?? null };
  } catch (e) {
    out.wikipediaError = (e as Error).message;
  }
  return out;
}
