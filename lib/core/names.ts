// Pencocokan nama pemain antar sumber data (Transfermarkt, FotMob, ESPN). Murni fungsi, tanpa fetch,
// jadi aman dipakai di server maupun komponen klien.

export const normName = (n: string) =>
  String(n ?? '')
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
 * Cari pemain di daftar: nama persis sama, lalu nama pendek yang semua katanya ada di nama panjang
 * ("Bremer" ↔ "Gleison Bremer"), lalu nama belakang. Pencocokan lemah hanya dipakai bila kandidatnya tepat satu;
 * kalau ragu, hasilnya null (tidak pernah menebak orang lain).
 */
export function findPlayer<T extends { name: string }>(name: string, pool: T[]): T | null {
  const t = normName(name);
  if (!t.length || !pool.length) return null;
  const key = t.join(' ');
  const toks = pool.map((p) => ({ p, tokens: normName(p.name) }));
  const unique = <U,>(list: U[]) => (list.length === 1 ? list[0] : null);

  const hit =
    toks.find((f) => f.tokens.join(' ') === key) ??
    unique(
      toks.filter((f) => {
        const [short, long] = t.length <= f.tokens.length ? [t, f.tokens] : [f.tokens, t];
        return short.length > 0 && short.every((w) => long.includes(w));
      })
    ) ??
    unique(toks.filter((f) => f.tokens.length > 1 && t.length > 1 && f.tokens.at(-1) === t.at(-1)));
  return hit?.p ?? null;
}

/** Kata nama dianggap sama bila persis sama, atau salah satunya awalan yang lain (min. 3 huruf): "Nico" ↔ "Nicolás". */
const sameWord = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));

/** Semua kata nama yang lebih pendek ada di nama yang lebih panjang ("Bremer" ↔ "Gleison Bremer"). Tanpa tebakan nama belakang saja. */
export const sameNameStrict = (a: string, b: string) => {
  const [x, y] = [normName(a), normName(b)];
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length > 0 && short.every((w) => long.some((l) => sameWord(w, l)));
};

