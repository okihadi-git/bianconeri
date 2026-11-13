// Statistik → Analisa → Pemain: murni fungsi (tanpa fetch), jadi gampang diuji.
//  1. Dampak pemain: poin/gol/kebobolan tim saat pemain jadi starter vs tidak (semua kompetisi, ESPN).
//  2. Duet terbaik: pasangan assist → gol dari kejadian laga ESPN.
//  3. Tonggak karier: angka dasar dari daftar Wikipedia (100+ laga untuk Juventus), ditambah otomatis dari laga sesudah tanggal acuannya.
// Tidak ada angka karangan: bila tabel Wikipedia tidak bisa dibaca, tonggak kosong dan alasannya ditampilkan.
import { parseTables } from './coaches';

export interface PMatch {
  id: string;
  iso: string;
  gf: number;
  ga: number;
  starters: { id: string; name: string }[];
  /** semua pemain Juventus yang turun main (starter + pengganti yang masuk) */
  played: { id: string; name: string; goals: number }[];
  /** gol Juventus yang punya assist */
  duets: { scorer: string; assist: string }[];
}

export interface PemainResponse {
  matches: number;
  impact: ImpactRow[];
  duets: DuetRow[];
  milestones: MilestoneRow[];
  wiki: { title: string; url: string; asOf: string | null } | null;
  warnings: string[];
  updatedAt: string;
}

/* ---------- nama ---------- */

const TRANSLIT: Record<string, string> = { 'ı': 'i', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'ß': 'ss', 'þ': 'th' };

export const norm = (s: string) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[ıøæœłđðßþ]/g, (c) => TRANSLIT[c] ?? c)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s-]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Nama sama: identik, atau nama belakang sama dan inisial depan sama, atau salah satu cuma satu kata yang cocok dengan nama lain. */
export function sameName(a: string, b: string): boolean {
  const x = norm(a).split(' ').filter(Boolean);
  const y = norm(b).split(' ').filter(Boolean);
  if (!x.length || !y.length) return false;
  if (x.join(' ') === y.join(' ')) return true;
  const lx = x[x.length - 1];
  const ly = y[y.length - 1];
  if (x.length === 1 || y.length === 1) {
    const single = x.length === 1 ? x[0] : y[0];
    const other = x.length === 1 ? y : x;
    return single.length >= 4 && (single === other[other.length - 1] || single === other[0]);
  }
  return lx.length >= 4 && lx === ly && x[0][0] === y[0][0];
}

const PARTICLES = new Set(['de', 'da', 'di', 'del', 'van', 'von', 'dos', 'le', 'la', 'el', 'al', 'ten', 'ter']);
/** "Federico Chiesa" → "Chiesa", "Matthijs de Ligt" → "de Ligt" */
export function shortName(name: string): string {
  const t = String(name ?? '').trim().split(/\s+/);
  if (t.length <= 1) return t[0] ?? '';
  const last = t[t.length - 1];
  const prev = t[t.length - 2];
  return PARTICLES.has(prev.toLowerCase()) ? `${prev} ${last}` : last;
}

/* ---------- 1. dampak starter vs tidak ---------- */

export interface ImpactRow {
  id: string;
  name: string;
  startN: number;
  outN: number;
  startPpg: number;
  outPpg: number;
  diff: number;
  startGf: number;
  outGf: number;
  startGa: number;
  outGa: number;
}

const pts = (m: PMatch) => (m.gf > m.ga ? 3 : m.gf === m.ga ? 1 : 0);
const avgOf = (l: number[]) => l.reduce((n, v) => n + v, 0) / l.length;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildImpact(matches: PMatch[], minStarts = 3, minOut = 2, limit = 12): ImpactRow[] {
  const names = new Map<string, string>();
  for (const m of matches) for (const s of m.starters) if (!names.has(s.id)) names.set(s.id, s.name);
  const rows: ImpactRow[] = [];
  for (const [id, name] of names) {
    const on = matches.filter((m) => m.starters.some((s) => s.id === id));
    const off = matches.filter((m) => !m.starters.some((s) => s.id === id));
    if (on.length < minStarts || off.length < minOut) continue;
    const sp = avgOf(on.map(pts));
    const op = avgOf(off.map(pts));
    rows.push({
      id,
      name,
      startN: on.length,
      outN: off.length,
      startPpg: r2(sp),
      outPpg: r2(op),
      diff: r2(sp - op),
      startGf: r2(avgOf(on.map((m) => m.gf))),
      outGf: r2(avgOf(off.map((m) => m.gf))),
      startGa: r2(avgOf(on.map((m) => m.ga))),
      outGa: r2(avgOf(off.map((m) => m.ga))),
    });
  }
  return rows.sort((a, b) => b.diff - a.diff || b.startN - a.startN).slice(0, limit);
}

/* ---------- 2. duet ---------- */

export interface DuetRow {
  assist: string;
  scorer: string;
  goals: number;
}

export function buildDuets(matches: PMatch[], limit = 8): DuetRow[] {
  const by = new Map<string, { assist: string; scorer: string; goals: number }>();
  for (const m of matches) {
    for (const d of m.duets) {
      if (!d.scorer || !d.assist) continue;
      const key = `${norm(d.assist)}>${norm(d.scorer)}`;
      const cur = by.get(key) ?? { assist: d.assist, scorer: d.scorer, goals: 0 };
      cur.goals += 1;
      by.set(key, cur);
    }
  }
  return [...by.values()]
    .sort((a, b) => b.goals - a.goals || a.assist.localeCompare(b.assist))
    .slice(0, limit)
    .map((d) => ({ assist: shortName(d.assist), scorer: shortName(d.scorer), goals: d.goals }));
}

/* ---------- 3. tonggak karier ---------- */

export interface WikiPlayer {
  name: string;
  apps: number;
  goals: number;
}

export interface MilestoneRow {
  name: string;
  apps: number;
  goals: number;
  nextApps: number;
  appsLeft: number;
  nextGoals: number;
  goalsLeft: number;
  /** laga dan gol yang ditambahkan dari pertandingan sesudah tanggal acuan Wikipedia */
  added: { apps: number; goals: number };
}

const APP_STEPS = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700];
const GOAL_STEPS = [10, 25, 50, 100, 150, 200, 250, 300];

/** Tonggak pertama yang LEBIH BESAR dari angka sekarang; lewat daftar → kelipatan 50. */
export function nextMilestone(n: number, steps: number[]): number {
  const hit = steps.find((s) => s > n);
  return hit ?? Math.floor(n / 50) * 50 + 50;
}

const MONTHS: Record<string, number> = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };

/** Tanggal acuan statistik di artikel ("correct as of match played 10 May 2026") → "2026-05-10" (UTC), atau null. */
export function parseAsOf(html: string): string | null {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ');
  const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
  const a = /as of(?:[^0-9]{0,60}?)(\d{1,2}) ([A-Za-z]+) (\d{4})/i.exec(text);
  if (a && MONTHS[a[2].toLowerCase()] != null) return iso(Number(a[3]), MONTHS[a[2].toLowerCase()], Number(a[1]));
  const b = /as of(?:[^0-9]{0,60}?)([A-Za-z]+) (\d{1,2}),? (\d{4})/i.exec(text);
  if (b && MONTHS[b[1].toLowerCase()] != null) return iso(Number(b[3]), MONTHS[b[1].toLowerCase()], Number(b[2]));
  return null;
}

const intOf = (s: string | undefined) => {
  const m = /\d[\d,]*/.exec(String(s ?? ''));
  return m ? parseInt(m[0].replace(/,/g, ''), 10) : null;
};
const cleanName = (s: string) =>
  s.replace(/\[[^\]]*\]/g, '').replace(/[†‡*§]/g, '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim();

/** Baca tabel daftar pemain Wikipedia (kolom nama, laga, gol). Baris yang tak bisa dibaca dilewati. */
export function parseWikiPlayers(html: string): { rows: WikiPlayer[]; asOf: string | null } {
  const rows: WikiPlayer[] = [];
  for (const table of parseTables(html)) {
    let hi = -1;
    let cName = -1;
    let cApps = -1;
    let cGoals = -1;
    for (let r = 0; r < Math.min(3, table.length) && hi < 0; r++) {
      const h = table[r].map((c) => c.text.trim());
      const n = h.findIndex((t) => /^(name|player)\b/i.test(t));
      const appsAll = h.map((t, i) => (/^(total\s+)?(apps?|appearances|games|matches)\b/i.test(t) ? i : -1)).filter((i) => i >= 0);
      const goalsAll = h.map((t, i) => (/^(total\s+)?goals\b/i.test(t) ? i : -1)).filter((i) => i >= 0);
      if (n >= 0 && appsAll.length && goalsAll.length) {
        hi = r;
        cName = n;
        cApps = appsAll.find((i) => /total/i.test(h[i])) ?? appsAll[0];
        cGoals = goalsAll.find((i) => /total/i.test(h[i])) ?? goalsAll[0];
      }
    }
    if (hi < 0) continue;
    for (const row of table.slice(hi + 1)) {
      if (row.length <= Math.max(cName, cApps, cGoals)) continue;
      const name = cleanName(row[cName].text);
      const apps = intOf(row[cApps].text);
      const goals = intOf(row[cGoals].text);
      if (name && apps != null && goals != null) rows.push({ name, apps, goals });
    }
  }
  return { rows, asOf: parseAsOf(html) };
}

/**
 * Tonggak tiap pemain skuad yang ada di daftar Wikipedia. Laga sesudah tanggal acuan (by tanggal UTC) ditambahkan dari data ESPN;
 * tanpa tanggal acuan, tidak ada yang ditambahkan (supaya tidak dobel hitung).
 */
export function buildMilestones(wiki: WikiPlayer[], asOf: string | null, matches: PMatch[], limit = 12): MilestoneRow[] {
  const squad = new Map<string, string>();
  for (const m of matches) for (const p of m.played) if (!squad.has(p.id)) squad.set(p.id, p.name);

  const out: MilestoneRow[] = [];
  for (const [id, name] of squad) {
    const w = wiki.find((x) => sameName(x.name, name));
    if (!w) continue;
    let apps = 0;
    let goals = 0;
    if (asOf) {
      for (const m of matches) {
        if (m.iso.slice(0, 10) <= asOf) continue;
        const p = m.played.find((x) => x.id === id);
        if (p) {
          apps += 1;
          goals += p.goals;
        }
      }
    }
    const A = w.apps + apps;
    const G = w.goals + goals;
    const nA = nextMilestone(A, APP_STEPS);
    const nG = nextMilestone(G, GOAL_STEPS);
    out.push({ name: w.name, apps: A, goals: G, nextApps: nA, appsLeft: nA - A, nextGoals: nG, goalsLeft: nG - G, added: { apps, goals } });
  }
  // yang paling dekat ke tonggak (laga atau gol) di atas
  return out.sort((a, b) => Math.min(a.appsLeft, a.goalsLeft) - Math.min(b.appsLeft, b.goalsLeft) || b.apps - a.apps).slice(0, limit);
}
