// Data skuad Juventus. Dua sumber tidak resmi, dicoba berurutan:
//   1. Transfermarkt JSON API (tmapi.transfermarkt.technology) — nilai pasar, kontrak, usia, kebangsaan, nomor punggung
//   2. FotMob (www.fotmob.com/api/data/teams) — cadangan bila Transfermarkt memblokir/gagal
// Format respons kedua sumber bisa berubah tanpa pemberitahuan. Tidak ada data yang dikarang:
// kalau sumber tidak punya nilainya, field-nya null.
import type { SquadGroup, SquadPlayer } from './types';

export const TM_BASE = 'https://tmapi.transfermarkt.technology';
export const TM_CLUB_ID = '506'; // Juventus di Transfermarkt
export const FOTMOB_TEAM_ID = '9885'; // Juventus di FotMob

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; bianconeri-matchday-hub)',
};

async function getJson(url: string, revalidate: number): Promise<any> {
  const res = await fetch(url, {
    headers: HEADERS,
    next: { revalidate },
    signal: AbortSignal.timeout(12000),
  });
  // Transfermarkt membalas 202 kosong / header WAF saat memblokir
  if (res.headers.get('x-amzn-waf-action') || (res.status === 202 && !res.headers.get('content-length'))) {
    throw new Error(`diblokir (WAF) ${url}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

/** Transfermarkt membungkus data di { success, data }. */
async function tm(path: string, params: [string, string][] = [], revalidate = 3600): Promise<any> {
  const qs = params.length ? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}` : '';
  const body = await getJson(`${TM_BASE}${path}${qs}`, revalidate);
  if (!body || body.success !== true || !('data' in body)) throw new Error(`payload tak terduga ${path}`);
  return body.data;
}

/* ---------- Transfermarkt ---------- */

const GROUP_BY_TM: Record<string, SquadGroup> = {
  GOALKEEPER: 'Kiper',
  DEFENDER: 'Bek',
  MIDFIELDER: 'Gelandang',
  FORWARD: 'Penyerang',
  ATTACK: 'Penyerang',
};

function groupFromText(text: string): SquadGroup {
  const t = text.toLowerCase();
  if (/goal|keeper|^gk/.test(t)) return 'Kiper';
  if (/back|defen|^cb|^lb|^rb/.test(t)) return 'Bek';
  if (/mid|^cm|^dm|^am|^lm|^rm/.test(t)) return 'Gelandang';
  if (/forward|striker|winger|attack|^cf|^ss|^lw|^rw|^st/.test(t)) return 'Penyerang';
  return 'Lainnya';
}

const moneyValue = (m: any): number | null => {
  const v = m?.value;
  return typeof v === 'number' && v > 0 ? v : null; // 0 = belum ada penilaian
};

export function parseTransfermarkt(input: {
  squad: any;
  players: any[];
  countries: any[];
  coach: string;
}): { players: SquadPlayer[]; coach: string } {
  const members: any[] = Array.isArray(input.squad?.squad) ? input.squad.squad : [];
  const current = members.filter((m) => m?.type === 'current');
  const list = current.length ? current : members;
  const byId = new Map(input.players.map((p) => [String(p?.id), p]));
  const countries = new Map<number, string>(input.countries.map((c: any) => [Number(c.id), String(c.name)]));

  const players: SquadPlayer[] = [];
  for (const m of list) {
    const id = String(m?.playerId ?? '');
    const p = byId.get(id);
    if (!p?.name) continue; // data pemain tak ditemukan di sumber
    const a = p.attributes ?? {};
    const nat = p.nationalityDetails?.nationalities ?? {};
    const nation = [nat.nationalityId, nat.secondNationalityId]
      .map((n) => countries.get(Number(n)))
      .filter((n): n is string => Boolean(n));
    const posName = String(a.position?.name ?? '');
    const posShort = String(a.position?.shortName ?? '');
    players.push({
      id,
      name: String(p.name),
      jersey: m?.shirtNumber != null ? String(m.shirtNumber) : '',
      captain: Boolean(m?.isCaptain),
      position: posName || posShort,
      group: GROUP_BY_TM[String(a.positionGroup ?? '')] ?? groupFromText(`${a.position?.category ?? ''} ${posName} ${posShort}`),
      age: typeof p.lifeDates?.age === 'number' ? p.lifeDates.age : null,
      nation,
      heightCm: typeof a.height === 'number' && a.height > 0 ? Math.round(a.height * 100) : null,
      contractUntil: typeof a.contractUntil === 'string' ? a.contractUntil : null,
      marketValue: moneyValue(p.marketValueDetails?.current),
      photo: String(p.portraitUrl ?? ''),
    });
  }
  return { players, coach: input.coach };
}

export async function fetchTransfermarkt(): Promise<{ players: SquadPlayer[]; coach: string }> {
  const squad = await tm(`/club/${TM_CLUB_ID}/squad`);
  const ids: string[] = (squad?.squad ?? []).map((m: any) => String(m.playerId)).filter(Boolean);
  if (!ids.length) throw new Error('skuad Transfermarkt kosong');

  const chunks: string[][] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 50) chunks.push(unique.slice(i, i + 50));

  const [playerChunks, attributes, coach] = await Promise.all([
    Promise.all(chunks.map((c) => tm('/players', c.map((id) => ['ids[]', id] as [string, string])))),
    tm('/attributes', [], 86400),
    fetchTmCoach().catch(() => ''), // pelatih hanya pelengkap
  ]);

  const players = playerChunks.flat();
  const parsed = parseTransfermarkt({ squad, players, countries: attributes?.countries ?? [], coach });
  if (!parsed.players.length) throw new Error('data pemain Transfermarkt kosong');
  return parsed;
}

async function fetchTmCoach(): Promise<string> {
  const c = await tm(`/club/${TM_CLUB_ID}/coach`);
  if (!c?.coachId) return '';
  const coaches = await tm('/coaches', [['ids[]', String(c.coachId)]]);
  return String(coaches?.[0]?.name ?? '');
}

/* ---------- FotMob ---------- */

export const fotmobPhoto = (id: number | string) => `https://images.fotmob.com/image_resources/playerimages/${id}.png`;

export function parseFotmob(data: any): { players: SquadPlayer[]; coach: string } {
  const groups: any[] = data?.squad?.squad ?? [];
  let coach = '';
  const players: SquadPlayer[] = [];
  for (const g of groups) {
    const title = String(g?.title ?? '');
    const members: any[] = Array.isArray(g?.members) ? g.members : [];
    if (/coach/i.test(title)) {
      coach = String(members[0]?.name ?? '');
      continue;
    }
    const group: SquadGroup = /keeper|goal/i.test(title)
      ? 'Kiper'
      : /defen/i.test(title)
      ? 'Bek'
      : /midfield/i.test(title)
      ? 'Gelandang'
      : /attack|forward|striker/i.test(title)
      ? 'Penyerang'
      : 'Lainnya';
    for (const m of members) {
      if (!m?.name) continue;
      const value = Number(m.transferValue);
      players.push({
        id: String(m.id ?? m.name),
        name: String(m.name),
        jersey: m.shirtNumber != null && m.shirtNumber !== '' ? String(m.shirtNumber) : '',
        captain: false,
        position: String(m.positionIdsDesc ?? m.role?.fallback ?? m.role?.key ?? ''),
        group,
        age: typeof m.age === 'number' ? m.age : null,
        nation: m.cname ? [String(m.cname)] : [],
        heightCm: typeof m.height === 'number' && m.height > 0 ? m.height : null,
        contractUntil: null,
        marketValue: Number.isFinite(value) && value > 0 ? value : null,
        photo: m.id ? fotmobPhoto(m.id) : '',
      });
    }
  }
  return { players, coach };
}

export async function fetchFotmob(): Promise<{ players: SquadPlayer[]; coach: string }> {
  const data = await getJson(`https://www.fotmob.com/api/data/teams?id=${FOTMOB_TEAM_ID}&ccode3=IDN`, 3600);
  const parsed = parseFotmob(data);
  if (!parsed.players.length) throw new Error('skuad FotMob kosong');
  return parsed;
}

/* ---------- Foto: FotMob untuk data Transfermarkt ---------- */

const normName = (n: string) =>
  n
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/['-]/g, '')
    .split(/\s+/)
    .filter(Boolean);

/**
 * Ganti foto pemain Transfermarkt dengan foto FotMob. Id kedua sumber berbeda, jadi dicocokkan lewat nama:
 * nama persis sama, lalu nama pendek yang seluruh katanya ada di nama panjang ("Bremer" ↔ "Gleison Bremer"),
 * lalu nama belakang. Pencocokan lemah hanya dipakai kalau kandidatnya tepat satu; kalau ragu, foto
 * Transfermarkt dipertahankan (tidak pernah menebak foto orang lain).
 */
export function withFotmobPhotos(players: SquadPlayer[], fotmob: SquadPlayer[]): SquadPlayer[] {
  const pool = fotmob.filter((f) => f.photo).map((f) => ({ photo: f.photo, tokens: normName(f.name) }));
  if (!pool.length) return players;

  const unique = <T,>(list: T[]) => (list.length === 1 ? list[0] : null);

  return players.map((p) => {
    const t = normName(p.name);
    if (!t.length) return p;
    const key = t.join(' ');

    const hit =
      pool.find((f) => f.tokens.join(' ') === key) ??
      unique(
        pool.filter((f) => {
          const [short, long] = t.length <= f.tokens.length ? [t, f.tokens] : [f.tokens, t];
          return short.length > 0 && short.every((w) => long.includes(w));
        })
      ) ??
      unique(pool.filter((f) => f.tokens.length > 1 && t.length > 1 && f.tokens.at(-1) === t.at(-1)));

    return hit ? { ...p, photo: hit.photo } : p;
  });
}
