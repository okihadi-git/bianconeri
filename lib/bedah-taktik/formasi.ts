// Statistik → Bedah Taktik → Formasi & XI: formasi yang dipakai dan XI yang paling sering main.
// Murni fungsi (tanpa fetch). Susunan baris & urutan kiri-kanan mengikuti posisi ESPN lewat layoutLines() (lib/core/pitch.ts),
// sama seperti Skor live, supaya keduanya konsisten.
import { depthOf, layoutLines } from '../core/pitch';

export interface FStarter {
  id: string;
  name: string;
  /** kode posisi ESPN: G, CD-L, DM, AM-R, F, ... */
  position: string;
}

/** Satu laga: formasi awal + 11 starter urut formationPlace (indeks 0 = kiper). */
export interface FMatch {
  id: string;
  iso: string;
  formation: string;
  starters: FStarter[];
}

export interface XiPlayer {
  id: string;
  name: string;
  /** jumlah laga sebagai starter (semua formasi) */
  starts: number;
  /** posisi ESPN yang paling sering dipakai pemain ini */
  position: string;
  /** koordinat di lapangan vertikal, 0–100 (y = 0 gawang lawan di atas, 100 gawang sendiri di bawah) */
  x: number;
  y: number;
}

export interface FormasiResult {
  matches: number;
  formations: { formation: string; matches: number }[];
  main: string | null;
  /** jumlah laga dengan formasi utama */
  mainMatches: number;
  xi: XiPlayer[];
}

const validFormation = (f: string) => /^\d(-\d){1,4}$/.test(String(f ?? '').trim());

/** Pemain dengan jumlah terbanyak; seri → yang lebih dulu. */
function modal<T>(items: T[]): T | null {
  const c = new Map<T, number>();
  for (const i of items) c.set(i, (c.get(i) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const [k, v] of c) if (v > n) { best = k; n = v; }
  return best;
}

/** Posisi mendatar pemain ke-k dari n di satu baris (0–100): baris lebar dibentangkan hampir selebar lapangan. */
export const xOf = (k: number, n: number) => (n === 1 ? 50 : n === 2 ? 34 + k * 32 : 11 + (k * 78) / (n - 1));

export function buildFormasi(all: FMatch[]): FormasiResult {
  const ms = all.filter((m) => m.starters.length === 11 && validFormation(m.formation));
  if (!ms.length) return { matches: 0, formations: [], main: null, mainMatches: 0, xi: [] };

  // formasi: berapa laga tiap formasi (urut terbanyak; seri → yang lebih baru)
  const tally = new Map<string, { n: number; last: string }>();
  for (const m of ms) {
    const t = tally.get(m.formation.trim()) ?? { n: 0, last: '' };
    t.n += 1;
    if (m.iso > t.last) t.last = m.iso;
    tally.set(m.formation.trim(), t);
  }
  const formations = [...tally.entries()].sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last)).map(([formation, t]) => ({ formation, matches: t.n }));
  const main = formations[0].formation;
  const mainMs = ms.filter((m) => m.formation.trim() === main);

  // statistik tiap pemain di SEMUA laga (angka starter + posisi paling sering)
  const starts = new Map<string, { name: string; n: number; pos: string[] }>();
  for (const m of ms)
    for (const s of m.starters) {
      const e = starts.get(s.id) ?? { name: s.name, n: 0, pos: [] };
      e.n += 1;
      e.pos.push(s.position);
      starts.set(s.id, e);
    }

  // slot = (baris, urutan di baris) menurut layoutLines pada laga berformasi utama
  const slotCount = new Map<string, Map<string, number>>();
  let template: string[][] = [];
  for (const m of mainMs) {
    const rows = layoutLines(m.starters, main);
    if (rows.length > template.length || !template.length) template = rows.map((r) => r.map(() => ''));
    rows.forEach((row, r) =>
      row.forEach((p, k) => {
        const key = `${r}:${k}`;
        const c = slotCount.get(key) ?? new Map<string, number>();
        c.set(p.id, (c.get(p.id) ?? 0) + 1);
        slotCount.set(key, c);
      })
    );
  }
  // bentuk baris yang dipakai = dari laga pertama berformasi utama
  const shape = layoutLines(mainMs[mainMs.length - 1].starters, main).map((r) => r.length);

  // penugasan serakah: pasangan (slot, pemain) dengan hitungan terbesar lebih dulu
  const pairs: { key: string; id: string; c: number }[] = [];
  for (const [key, c] of slotCount) for (const [id, n] of c) pairs.push({ key, id, c: n });
  pairs.sort((a, b) => b.c - a.c || (starts.get(b.id)?.n ?? 0) - (starts.get(a.id)?.n ?? 0));
  const slotOf = new Map<string, string>();
  const taken = new Set<string>();
  for (const p of pairs) {
    const [r, k] = p.key.split(':').map(Number);
    if (r >= shape.length || k >= shape[r]) continue; // slot di luar bentuk
    if (slotOf.has(p.key) || taken.has(p.id)) continue;
    slotOf.set(p.key, p.id);
    taken.add(p.id);
  }
  // slot yang belum terisi (rotasi berat): isi dengan starter terbanyak yang belum terpakai, cocokkan kedalaman posisi
  const rowDepth = (r: number) => {
    const ids = [...slotOf.entries()].filter(([k]) => k.startsWith(`${r}:`)).map(([, id]) => depthOf(modal(starts.get(id)?.pos ?? []) ?? ''));
    return ids.length ? ids[0] : null;
  };
  const rest = [...starts.entries()].filter(([id]) => !taken.has(id)).sort((a, b) => b[1].n - a[1].n);
  shape.forEach((n, r) => {
    for (let k = 0; k < n; k++) {
      const key = `${r}:${k}`;
      if (slotOf.has(key)) continue;
      const want = rowDepth(r);
      let idx = want == null ? 0 : rest.findIndex(([, e]) => depthOf(modal(e.pos) ?? '') === want);
      if (idx < 0) idx = 0;
      const [id] = rest.splice(idx, 1)[0] ?? [];
      if (id) {
        slotOf.set(key, id);
        taken.add(id);
      }
    }
  });

  // koordinat: baris 0 (kiper) di bawah, baris terakhir (penyerang) di atas
  const R = shape.length;
  const xi: XiPlayer[] = [];
  shape.forEach((n, r) => {
    for (let k = 0; k < n; k++) {
      const id = slotOf.get(`${r}:${k}`);
      const e = id ? starts.get(id) : undefined;
      if (!id || !e) continue;
      xi.push({
        id,
        name: e.name,
        starts: e.n,
        position: modal(e.pos) ?? '',
        x: Math.round(xOf(k, n) * 10) / 10,
        y: Math.round((88 - (R === 1 ? 0 : (r * 76) / (R - 1))) * 10) / 10,
      });
    }
  });
  return { matches: ms.length, formations, main, mainMatches: mainMs.length, xi };
}
