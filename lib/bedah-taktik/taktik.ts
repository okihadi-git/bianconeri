// Statistik → Bedah Taktik → Ringkasan taktik: murni fungsi (tanpa fetch) di atas FotMob matchDetails.
// Setiap poin hanya dibuat bila datanya benar-benar ada; tidak ada angka karangan.

export interface TaktikMatch {
  formation: string | null;
  /** xG per situasi, tim sendiri dan lawan */
  own: { xg: number; shots: number; bySituation: Record<string, { xg: number; shots: number }>; central: number; wide: number; byPlayer: Record<string, { name: string; xg: number; shots: number }> };
  oppXg: number;
  possession: number | null;
  fouls: number | null;
  oppFouls: number | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace('%', ''));
  return Number.isFinite(n) ? n : null;
};

/** Cari satu statistik tim di content.stats.Periods.All, mengembalikan [tuan rumah, tandang]. */
function teamStat(data: any, keyRe: RegExp): [number | null, number | null] | null {
  const groups: any[] = data?.content?.stats?.Periods?.All?.stats ?? [];
  for (const g of groups) {
    for (const s of g?.stats ?? []) {
      if (keyRe.test(String(s?.key ?? '')) || keyRe.test(String(s?.title ?? ''))) {
        const arr = s?.stats;
        if (Array.isArray(arr) && arr.length >= 2) return [num(arr[0]), num(arr[1])];
      }
    }
  }
  return null;
}

export function parseTaktik(data: any, teamId: string): TaktikMatch | null {
  const g = data?.general;
  const homeId = String(g?.homeTeam?.id ?? '');
  const awayId = String(g?.awayTeam?.id ?? '');
  if (teamId !== homeId && teamId !== awayId) return null;
  const isHome = teamId === homeId;

  const lineup = data?.content?.lineup;
  const fm = (isHome ? lineup?.homeTeam : lineup?.awayTeam)?.formation;
  const formation = typeof fm === 'string' && /^\d(-\d){2,4}$/.test(fm.trim()) ? fm.trim() : null;

  const own: TaktikMatch['own'] = { xg: 0, shots: 0, bySituation: {}, central: 0, wide: 0, byPlayer: {} };
  let oppXg = 0;
  const shots: any[] = Array.isArray(data?.content?.shotmap?.shots) ? data.content.shotmap.shots : [];
  if (!shots.length && !formation) return null;
  for (const s of shots) {
    const xg = num(s?.expectedGoals) ?? 0;
    if (String(s?.teamId) !== teamId) {
      oppXg += xg;
      continue;
    }
    own.xg += xg;
    own.shots += 1;
    const sit = String(s?.situation ?? 'Lainnya');
    const b = (own.bySituation[sit] ??= { xg: 0, shots: 0 });
    b.xg += xg;
    b.shots += 1;
    // koridor tengah = sepertiga tengah lebar lapangan (y 0–68); tidak bergantung arah serangan
    const y = num(s?.y);
    if (y != null) (y >= 68 / 3 && y <= (68 * 2) / 3 ? (own.central += xg) : (own.wide += xg));
    const pid = String(s?.playerId ?? '');
    if (pid) {
      const p = (own.byPlayer[pid] ??= { name: String(s?.playerName ?? ''), xg: 0, shots: 0 });
      p.xg += xg;
      p.shots += 1;
    }
  }

  const poss = teamStat(data, /possess|possesion/i);
  const fouls = teamStat(data, /^fouls$/i);
  const pick = (t: [number | null, number | null] | null, mine: boolean) => (t ? t[mine === isHome ? 0 : 1] : null);
  return { formation, own, oppXg, possession: pick(poss, true), fouls: pick(fouls, true), oppFouls: pick(fouls, false) };
}

const d1 = (n: number) => n.toFixed(1).replace('.', ',');
const d2 = (n: number) => n.toFixed(2).replace('.', ',');
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const SITUATION_PHRASE: Record<string, string> = {
  RegularPlay: 'permainan terbuka',
  FromCorner: 'sepak pojok',
  SetPiece: 'bola mati',
  FastBreak: 'serangan balik',
  ThrowInSetPiece: 'lemparan ke dalam',
  Penalty: 'penalti',
};

/** Poin-poin ringkasan; `**teks**` = tebal. */
export function buildRingkasan(matches: TaktikMatch[], club = 'Juventus'): string[] {
  const out: string[] = [];
  const n = matches.length;
  if (!n) return out;

  // 1. Formasi
  const forms = new Map<string, number>();
  for (const m of matches) if (m.formation) forms.set(m.formation, (forms.get(m.formation) ?? 0) + 1);
  const ranked = [...forms.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length) {
    const total = ranked.reduce((s, [, c]) => s + c, 0);
    out.push(`${club} paling sering memakai **${ranked[0][0]}** (${ranked[0][1]} dari ${total} laga)${ranked[1] ? `, dengan variasi ${ranked[1][0]}` : ''}.`);
  }

  const withShots = matches.filter((m) => m.own.shots > 0);
  const xg = withShots.reduce((s, m) => s + m.own.xg, 0);
  const shots = withShots.reduce((s, m) => s + m.own.shots, 0);

  // 2. Arah serangan
  const central = withShots.reduce((s, m) => s + m.own.central, 0);
  const wide = withShots.reduce((s, m) => s + m.own.wide, 0);
  if (central + wide > 0) {
    const c = pct(central, central + wide);
    out.push(c >= 50 ? `Serangan condong ke **tengah**: ${c}% xG ${club} lahir dari koridor itu.` : `Serangan lebih banyak lewat **sisi lapangan**: ${100 - c}% xG ${club} lahir di luar koridor tengah.`);
  }

  // 3. Situasi tembakan terbanyak
  const sit: Record<string, number> = {};
  withShots.forEach((m) => Object.entries(m.own.bySituation).forEach(([k, v]) => (sit[k] = (sit[k] ?? 0) + v.shots)));
  const topSit = Object.entries(sit).sort((a, b) => b[1] - a[1])[0];
  if (topSit && shots) out.push(`Tembakan paling sering lahir dari **${SITUATION_PHRASE[topSit[0]] ?? topSit[0]}** (${pct(topSit[1], shots)}% tembakan).`);

  // 4. Pencetak xG terbanyak
  const people = new Map<string, { name: string; xg: number; shots: number }>();
  withShots.forEach((m) => Object.entries(m.own.byPlayer).forEach(([id, p]) => {
    const c = people.get(id) ?? { name: p.name, xg: 0, shots: 0 };
    c.xg += p.xg;
    c.shots += p.shots;
    people.set(id, c);
  }));
  const top = [...people.values()].sort((a, b) => b.xg - a.xg)[0];
  if (top && top.name) out.push(`Pemain dengan xG terbesar: **${top.name}** (${d2(top.xg)} xG dari ${top.shots} tembakan).`);

  // 5. xG per laga vs lawan
  if (withShots.length) {
    const mine = xg / withShots.length;
    const opp = withShots.reduce((s, m) => s + m.oppXg, 0) / withShots.length;
    const verdict = opp > 0 && mine / opp >= 1.5 ? 'jauh unggul' : mine / (opp || 1) > 1.1 ? 'unggul, tapi tidak mutlak' : mine / (opp || 1) >= 0.9 ? 'relatif seimbang' : 'tertinggal';
    out.push(`Rata-rata xG per laga **${d2(mine)}** berbanding **${d2(opp)}** untuk lawan — ${verdict}.`);
  }

  // 6. Bola mati
  if (xg > 0) {
    const sp = withShots.reduce((s, m) => s + (m.own.bySituation.FromCorner?.xg ?? 0) + (m.own.bySituation.SetPiece?.xg ?? 0), 0);
    out.push(`Bola mati (sepak pojok dan tendangan bebas) menyumbang **${pct(sp, xg)}%** dari total xG ${club}.`);
  }

  // 7. Penguasaan bola & pelanggaran
  const poss = matches.map((m) => m.possession).filter((v): v is number => v != null);
  const f = matches.filter((m) => m.fouls != null && m.oppFouls != null);
  if (poss.length || f.length) {
    const parts: string[] = [];
    if (poss.length) parts.push(`penguasaan bola rata-rata **${Math.round(poss.reduce((a, b) => a + b, 0) / poss.length)}%**`);
    if (f.length) parts.push(`pelanggaran per laga **${d1(f.reduce((s, m) => s + m.fouls!, 0) / f.length)}** (lawan ${d1(f.reduce((s, m) => s + m.oppFouls!, 0) / f.length)})`);
    out.push(`${club}: ${parts.join('; ')}.`);
  }
  return out;
}
