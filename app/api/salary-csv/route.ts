import { NextResponse } from 'next/server';
import { findPlayer } from '@/lib/names';
import { SALARY_ROWS, salaryCsv, type SalaryIds } from '@/lib/salaryleaks-data';
import { fetchFotmob, fetchTransfermarkt } from '@/lib/squad';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

/**
 * CSV gaji (SalaryLeaks) dengan kolom ID yang diisi dari API skuad proyek ini.
 *   /api/salary-csv        → file salaryleaks.csv siap impor ke Supabase
 *   /api/salary-csv?cek=1  → laporan JSON: siapa yang cocok dan siapa yang tidak
 * player_id = ID yang dikirim /api/squad (Transfermarkt; FotMob bila Transfermarkt gagal). tm_id dan fotmob_id disertakan
 * keduanya supaya pencocokan tetap jalan kapan pun salah satu sumber sedang gagal.
 */
export async function GET(req: Request) {
  const [tm, fm] = await Promise.allSettled([fetchTransfermarkt(), fetchFotmob()]);
  const tmPlayers = tm.status === 'fulfilled' ? tm.value.players : [];
  const fmPlayers = fm.status === 'fulfilled' ? fm.value.players : [];

  // Tanpa kedua sumber, CSV akan berisi ID kosong dan menyesatkan: lebih baik gagal dengan jelas.
  if (!tmPlayers.length || !fmPlayers.length) {
    return NextResponse.json(
      {
        error: 'ID belum bisa diambil lengkap. Coba muat ulang beberapa saat lagi.',
        transfermarkt: tmPlayers.length ? `${tmPlayers.length} pemain` : `gagal: ${tm.status === 'rejected' ? String(tm.reason?.message ?? tm.reason) : 'kosong'}`,
        fotmob: fmPlayers.length ? `${fmPlayers.length} pemain` : `gagal: ${fm.status === 'rejected' ? String(fm.reason?.message ?? fm.reason) : 'kosong'}`,
      },
      { status: 502 }
    );
  }

  const joined = SALARY_ROWS.map((row) => {
    const t = findPlayer(row.name, tmPlayers);
    const f = findPlayer(row.name, fmPlayers);
    const ids: SalaryIds = { playerId: t?.id ?? f?.id ?? '', tmId: t?.id ?? '', fotmobId: f?.id ?? '' };
    return { row, ids, tmName: t?.name ?? '', fotmobName: f?.name ?? '' };
  });

  if (new URL(req.url).searchParams.get('cek')) {
    return NextResponse.json({
      total: joined.length,
      cocokTransfermarkt: joined.filter((j) => j.ids.tmId).length,
      cocokFotmob: joined.filter((j) => j.ids.fotmobId).length,
      tanpaId: joined.filter((j) => !j.ids.playerId).map((j) => j.row.name),
      hanyaSatuSumber: joined.filter((j) => j.ids.playerId && (!j.ids.tmId || !j.ids.fotmobId)).map((j) => `${j.row.name} (tm: ${j.ids.tmId || '-'}, fotmob: ${j.ids.fotmobId || '-'})`),
      daftar: joined.map((j) => ({ salaryleaks: j.row.name, transfermarkt: j.tmName, fotmob: j.fotmobName, playerId: j.ids.playerId })),
    });
  }

  return new NextResponse(salaryCsv(joined), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="salaryleaks.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
