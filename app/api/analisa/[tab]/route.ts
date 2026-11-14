import { NextResponse } from 'next/server';
import { fetchJadwal } from '@/lib/analisa/jadwal-server';
import { fetchKiper } from '@/lib/analisa/kiper';
import { fetchLawan } from '@/lib/analisa/lawan-server';
import { fetchPemain } from '@/lib/analisa/pemain-server';
import { fetchPenonton } from '@/lib/analisa/penonton';
import { debugPeringkat, fetchPeringkat } from '@/lib/analisa/peringkat-server';
import { fetchPola } from '@/lib/analisa/pola-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ttl = (sMaxAge: number, swr: number) => `s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
const NO_STORE = 'no-store';

interface Endpoint {
  load: () => Promise<any | null>;
  /** Cache-Control menurut isi respons (kosong = jangan di-cache) */
  cache: (body: any) => string;
  /** bila load() mengembalikan null → 502 dengan pesan ini */
  missing?: string;
  /** diagnosis lewat ?debug=1 (tanpa cache) */
  debug?: () => Promise<unknown>;
}

/** Semua tab Analisa: /api/analisa/{lawan|jadwal|pola|pemain|kiper|penonton|peringkat}. Tab baru = satu baris di sini. */
const ENDPOINTS: Record<string, Endpoint> = {
  // prediksi skor, perbandingan musim ini, hasil terakhir lawan, cuaca
  lawan: { load: fetchLawan, cache: () => ttl(600, 1800), missing: 'Jadwal Juventus belum bisa dimuat dari ESPN' },
  // xPts laga Serie A berikutnya tiap tim (model Poisson dari gol musim ini)
  jadwal: { load: fetchJadwal, cache: () => ttl(900, 3600), missing: 'Klasemen Serie A belum bisa dimuat dari ESPN' },
  // menit gol, situasi skor, kandang/tandang, level lawan (ESPN) + xG per laga (FotMob, opsional)
  pola: { load: fetchPola, cache: (b) => (b.games.length ? ttl(600, 3600) : NO_STORE) },
  // dampak starter vs tidak, duet assist→gol, tonggak karier (ESPN + Wikipedia)
  pemain: { load: fetchPemain, cache: (b) => (b.matches ? ttl(900, 3600) : NO_STORE) },
  // HANYA kiper: penyelamatan, clean sheet, gol dicegah dibanding xG
  kiper: { load: fetchKiper, cache: (b) => (b.matches ? ttl(600, 3600) : NO_STORE) },
  // penonton tiap laga resmi sejak awal musim (ESPN)
  penonton: { load: fetchPenonton, cache: (b) => (b.rows.length ? ttl(600, 3600) : NO_STORE) },
  // koefisien UEFA 5 musim: 10 besar + Juventus
  peringkat: { load: fetchPeringkat, cache: (b) => (b.top.length ? ttl(1800, 21600) : NO_STORE), debug: debugPeringkat },
};

export async function GET(req: Request, ctx: { params: Promise<{ tab: string }> }) {
  const { tab } = await ctx.params;
  const ep = Object.prototype.hasOwnProperty.call(ENDPOINTS, tab) ? ENDPOINTS[tab] : null;
  if (!ep) return NextResponse.json({ error: 'Tab analisa tidak dikenal' }, { status: 404 });

  try {
    if (ep.debug && new URL(req.url).searchParams.get('debug') === '1') return NextResponse.json(await ep.debug(), { headers: { 'Cache-Control': NO_STORE } });
    const body = await ep.load();
    if (body == null) return NextResponse.json({ error: ep.missing ?? 'Data belum tersedia' }, { status: 502 });
    return NextResponse.json(body, { headers: { 'Cache-Control': ep.cache(body) } });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
