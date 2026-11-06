// Membaca respons heatmap FotMob per laga. Bentuk pastinya tidak terdokumentasi, jadi pembacanya longgar:
// semua string yang berisi <circle cx=".." cy=".."/> dikumpulkan, dan dikaitkan ke pemain lewat kunci angka
// (mis. { "961995": "<circle…/>" }) atau lewat objek yang punya playerId/id angka.
// Koordinat FotMob memakai bidang 105 × 68 (kolom 0–105, baris 0–68).

export type Point = [number, number];

const CIRCLE = /<circle\b[^>]*?\bcx="(-?[\d.]+)"[^>]*?\bcy="(-?[\d.]+)"/g;
const NUMERIC = /^\d{3,}$/;

export function circlesIn(text: string): Point[] {
  const out: Point[] = [];
  for (const m of text.matchAll(CIRCLE)) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push([x, y]);
  }
  return out;
}

/** Kunci seperti "857269", "player_857269", "857269.svg" → "857269". */
const idFromKey = (k: string): string | null => /(\d{5,})/.exec(k)?.[1] ?? null;

/** ID pemain dari kolom milik objek itu sendiri (playerId, player_id, pid, id, …); kolom teamId diabaikan. */
function idOfObject(o: Record<string, unknown>): string | undefined {
  const isId = (v: unknown) => NUMERIC.test(String(v ?? ''));
  for (const k of ['playerId', 'player_id', 'pid', 'id']) if (isId(o[k])) return String(o[k]);
  for (const [k, v] of Object.entries(o)) if (/id$/i.test(k) && !/^(team|match|league)/i.test(k) && isId(v)) return String(v);
  return undefined;
}

/** playerId → titik. "_" = ada titik tetapi tidak bisa dikaitkan ke pemain. */
export function collectByPlayer(root: unknown): Map<string, Point[]> {
  const found = new Map<string, Point[]>();
  const add = (id: string, pts: Point[]) => {
    if (pts.length) found.set(id, [...(found.get(id) ?? []), ...pts]);
  };

  const walk = (node: unknown, ctx: string, depth: number) => {
    if (depth > 10 || node == null) return;
    if (typeof node === 'string') {
      if (node.includes('<circle')) add(ctx, circlesIn(node));
      return;
    }
    if (Array.isArray(node)) {
      // pasangan [idPemain, "<circle…/>"]
      if (node.length === 2 && NUMERIC.test(String(node[0] ?? '')) && typeof node[1] === 'string') {
        walk(node[1], String(node[0]), depth + 1);
        return;
      }
      for (const x of node) walk(x, ctx, depth + 1);
      return;
    }
    if (typeof node === 'object') {
      const o = node as Record<string, unknown>;
      const own = idOfObject(o);
      for (const [k, v] of Object.entries(o)) walk(v, idFromKey(k) ?? own ?? ctx, depth + 1);
    }
  };

  walk(root, '_', 0);
  return found;
}

/** Titik milik satu pemain, atau null kalau respons tidak memuat pemain itu. */
export function playerPoints(root: unknown, playerId: string): Point[] | null {
  const pts = collectByPlayer(root).get(playerId);
  return pts?.length ? pts : null;
}
