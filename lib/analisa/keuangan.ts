// Analisa → Peringkat & keuangan → Keuangan klub. Tiga sumber, semuanya boleh kosong tanpa merusak yang lain:
//  1. Pendapatan: Deloitte Football Money League (terbit tiap Januari) — DIISI MANUAL di REVENUE di bawah, bukan API.
//  2. Gaji: tabel Supabase `player_salaries` project ini (lib/salaries-server.ts), dicocokkan ke skuad lewat ID/nama ketat.
//  3. Nilai pasar & kontrak: skuad Transfermarkt (cadangan FotMob), sama dengan halaman Skuad.
// Tidak ada angka karangan: tanpa sumber → null dan UI menampilkan "–".
import { salaryFrom, yearlyOf, weeklyOf, type Salary } from '../pemain/salaries';
import { fetchSalariesDetailed } from '../pemain/salaries-server';
import { fetchFotmob, fetchTransfermarkt } from '../core/squad';
import type { SquadPlayer } from '../core/types';

/** Perbarui tiap Januari saat Deloitte merilis edisi baru. Angka dalam juta euro. */
export const REVENUE = {
  edition: 'Deloitte Football Money League 2026',
  season: '2024/25',
  rank: 16,
  total: 401.7,
  matchday: 64.5,
  broadcast: 177.4,
  commercial: 159.8,
};

export interface WageRow {
  name: string;
  yearly: number;
  weekly: number | null;
  marketValue: number | null;
  /** kontrak sampai, YYYY-MM-DD */
  until: string | null;
}

export interface KeuanganResponse {
  revenue: typeof REVENUE;
  squad: {
    source: 'transfermarkt' | 'fotmob';
    players: number;
    withValue: number;
    totalValue: number | null;
    top: { name: string; value: number } | null;
    /** kontrak berakhir dalam 12 bulan ke depan */
    ending: { count: number; value: number | null; names: string[] };
  } | null;
  wages: {
    /** pemain skuad yang gajinya ditemukan di tabel */
    matched: number;
    of: number;
    yearTotal: number;
    average: number;
    top: WageRow[];
  } | null;
  warnings: string[];
  updatedAt: string;
}

const DAY = 86_400_000;

export function buildKeuangan(
  squad: { source: 'transfermarkt' | 'fotmob'; players: SquadPlayer[] } | null,
  salaries: Salary[] | null,
  now = new Date(),
  warnings: string[] = []
): KeuanganResponse {
  let sq: KeuanganResponse['squad'] = null;
  let wages: KeuanganResponse['wages'] = null;

  if (squad?.players.length) {
    const ps = squad.players;
    const valued = ps.filter((p) => p.marketValue != null) as (SquadPlayer & { marketValue: number })[];
    const top = valued.reduce<(SquadPlayer & { marketValue: number }) | null>((b, p) => (!b || p.marketValue > b.marketValue ? p : b), null);
    const t = now.getTime();
    const ending = ps.filter((p) => {
      const u = p.contractUntil ? new Date(p.contractUntil).getTime() : NaN;
      return Number.isFinite(u) && u >= t && u <= t + 365 * DAY;
    });
    const endValued = ending.filter((p) => p.marketValue != null);
    sq = {
      source: squad.source,
      players: ps.length,
      withValue: valued.length,
      totalValue: valued.length ? valued.reduce((n, p) => n + p.marketValue, 0) : null,
      top: top ? { name: top.name, value: top.marketValue } : null,
      ending: { count: ending.length, value: endValued.length ? endValued.reduce((n, p) => n + (p.marketValue as number), 0) : null, names: ending.map((p) => p.name) },
    };

    if (salaries?.length) {
      const rows: WageRow[] = [];
      for (const p of ps) {
        const s = salaryFrom(salaries, { name: p.name, ids: squad.source === 'transfermarkt' ? { tm: p.id } : { fotmob: p.id } });
        const yearly = s ? yearlyOf(s) : null;
        if (s && yearly != null) rows.push({ name: p.name, yearly, weekly: weeklyOf(s), marketValue: p.marketValue, until: s.expiration ?? p.contractUntil });
      }
      if (rows.length) {
        const yearTotal = rows.reduce((n, r) => n + r.yearly, 0);
        wages = { matched: rows.length, of: ps.length, yearTotal, average: Math.round(yearTotal / rows.length), top: rows.sort((a, b) => b.yearly - a.yearly).slice(0, 8) };
      }
    }
  }
  return { revenue: REVENUE, squad: sq, wages, warnings, updatedAt: new Date().toISOString() };
}

export async function fetchKeuangan(): Promise<KeuanganResponse> {
  const warnings: string[] = [];
  const [squad, sal] = await Promise.all([
    (async () => {
      try {
        return { source: 'transfermarkt' as const, players: (await fetchTransfermarkt()).players };
      } catch {
        try {
          return { source: 'fotmob' as const, players: (await fetchFotmob()).players };
        } catch {
          warnings.push('Skuad (nilai pasar dan kontrak) belum bisa dimuat dari Transfermarkt maupun FotMob.');
          return null;
        }
      }
    })(),
    fetchSalariesDetailed().catch(() => ({ salaries: [] as Salary[], reason: 'tabel gaji tidak bisa dihubungi' })),
  ]);
  if (!sal.salaries.length) warnings.push(`Data gaji tidak tersedia: ${sal.reason ?? 'tabel kosong'}`);
  const body = buildKeuangan(squad, sal.salaries.length ? sal.salaries : null, new Date(), warnings);
  if (body.squad && sal.salaries.length && !body.wages) body.warnings.push('Tidak ada pemain skuad yang cocok dengan tabel gaji (ID atau nama tidak sama).');
  return body;
}
