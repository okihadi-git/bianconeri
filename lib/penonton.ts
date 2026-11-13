// Analisa → Penonton. ESPN: jumlah penonton (competitions[0].attendance, cadangan gameInfo.attendance di ringkasan laga) dan stadion.
// Hanya pertandingan resmi dari awal musim sampai laga selesai terbaru: kompetisi di COMPETITIONS (liga, Eropa, piala);
// laga persahabatan/ujicoba tidak pernah masuk dan tetap disaring di sini kalau ada yang lolos lewat jadwal cadangan.
import { COMPETITIONS, JUVE_ID, isCompleted, toNum } from './espn';
import { fetchSummary } from './live';

/** Kandang Juventus. ESPN tidak memberi kapasitas, jadi diisi manual; ubah di sini bila berubah. */
export const HOME_STADIUM = { name: 'Allianz Stadium', capacity: 41507 };

const LEAGUE_LABEL: Record<string, string> = {
  'ita.1': 'Liga',
  'uefa.champions': 'UCL',
  'uefa.europa': 'UEL',
  'ita.coppa_italia': 'Coppa Italia',
  'ita.super_cup': 'Supercoppa',
};

export interface CrowdRow {
  id: string;
  iso: string;
  /** "7 Nov" (WIB) */
  dateLabel: string;
  opp: string;
  home: boolean;
  neutral: boolean;
  /** "Liga", "UCL", ... */
  league: string;
  /** skor akhir, Juventus lebih dulu: "1–0" */
  score: string;
  venue: string;
  /** null = ESPN tidak melaporkan jumlah penonton */
  attendance: number | null;
}

export interface PenontonResponse {
  rows: CrowdRow[];
  homeAvg: number | null;
  homeMatches: number;
  /** persen terhadap kapasitas; null bila tidak ada laga kandang dengan data */
  homeFill: number | null;
  awayAvg: number | null;
  awayMatches: number;
  top: { attendance: number; opp: string; venue: string } | null;
  total: number;
  /** jumlah laga yang punya data penonton (dasar total) */
  counted: number;
  stadium: { name: string; capacity: number };
  warnings: string[];
  updatedAt: string;
}

const isOfficial = (e: any) => COMPETITIONS.some((c) => c.slug === e?._league) && !/friendl/i.test(`${e?._league ?? ''} ${e?.league?.slug ?? ''} ${e?.season?.slug ?? ''}`);

const positive = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(/[,\s]/g, '')) : toNum(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = new Intl.DateTimeFormat('id-ID', { day: 'numeric', timeZone: 'Asia/Jakarta' }).format(d);
  const mon = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'Asia/Jakarta' }).format(d).replace('.', '');
  return `${day} ${mon}`;
}

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Hitung penonton dari semua laga resmi Juventus yang sudah selesai. `load` disuntik supaya bisa diuji tanpa jaringan. */
export async function buildCrowd(
  events: any[],
  load: (league: string, id: string, live: boolean) => Promise<any | null> = fetchSummary
): Promise<PenontonResponse> {
  const done = events.filter((e) => isCompleted(e) && isOfficial(e));
  const rows: CrowdRow[] = [];
  for (const e of done) {
    const comp = e.competitions?.[0];
    const juve = comp?.competitors?.find((c: any) => String(c?.team?.id) === JUVE_ID);
    const opp = comp?.competitors?.find((c: any) => String(c?.team?.id) !== JUVE_ID);
    if (!juve || !opp) continue;
    const iso = new Date(e.date).toISOString();
    rows.push({
      id: String(e.id),
      iso,
      dateLabel: dateLabel(iso),
      opp: String(opp?.team?.displayName ?? 'TBA'),
      home: juve.homeAway === 'home',
      neutral: comp?.neutralSite === true,
      league: LEAGUE_LABEL[e._league] ?? String(e._league),
      score: `${toNum(juve.score)}–${toNum(opp.score)}`,
      venue: String(comp?.venue?.fullName ?? ''),
      attendance: positive(comp?.attendance),
    });
  }

  // Cadangan: ringkasan laga ESPN untuk laga yang jumlah penontonnya kosong di scoreboard.
  const byId = new Map(done.map((e) => [String(e.id), e]));
  const missing = rows.filter((r) => r.attendance == null);
  for (let i = 0; i < missing.length; i += 8) {
    const batch = missing.slice(i, i + 8);
    const res = await Promise.all(batch.map((r) => load(String(byId.get(r.id)?._league), r.id, false).catch(() => null)));
    batch.forEach((r, k) => {
      const info = res[k]?.gameInfo;
      r.attendance = positive(info?.attendance);
      if (!r.venue) r.venue = String(info?.venue?.fullName ?? '');
    });
  }

  rows.sort((a, b) => b.iso.localeCompare(a.iso)); // terbaru di atas

  const counted = rows.filter((r) => r.attendance != null);
  const homeAtt = counted.filter((r) => r.home && !r.neutral).map((r) => r.attendance as number);
  const awayAtt = counted.filter((r) => !r.home && !r.neutral).map((r) => r.attendance as number);
  const homeAvg = mean(homeAtt);
  const best = counted.reduce<CrowdRow | null>((b, r) => (!b || (r.attendance as number) > (b.attendance as number) ? r : b), null);

  const warnings: string[] = [];
  if (!rows.length) warnings.push('Belum ada laga resmi Juventus yang selesai di data ESPN.');
  else if (!counted.length) warnings.push('ESPN tidak melaporkan jumlah penonton untuk laga-laga ini.');
  else if (counted.length < rows.length) warnings.push(`ESPN tidak melaporkan jumlah penonton untuk ${rows.length - counted.length} dari ${rows.length} laga; laga itu tidak ikut rata-rata dan total.`);
  if (rows.some((r) => r.neutral)) warnings.push('Laga di stadion netral tidak dihitung sebagai kandang maupun tandang, tetapi ikut total dan "terbanyak".');

  return {
    rows,
    homeAvg,
    homeMatches: homeAtt.length,
    homeFill: homeAvg == null ? null : Math.round((homeAvg / HOME_STADIUM.capacity) * 100),
    awayAvg: mean(awayAtt),
    awayMatches: awayAtt.length,
    top: best ? { attendance: best.attendance as number, opp: best.opp, venue: best.venue } : null,
    total: counted.reduce((n, r) => n + (r.attendance as number), 0),
    counted: counted.length,
    stadium: HOME_STADIUM,
    warnings,
    updatedAt: new Date().toISOString(),
  };
}
