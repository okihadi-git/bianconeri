# Bianconeri Matchday Hub

Dashboard Juventus: skor live, klasemen, jadwal, skuad, dan statistik. UI berbahasa Indonesia, waktu dalam WIB.

## Menjalankan

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

Root Directory di Vercel harus menunjuk ke folder yang berisi `package.json`.

## Struktur

```
app/
  page.tsx            Beranda: skor live, ringkasan 3 kompetisi, laga berikutnya, kalender gabungan
  kompetisi/page.tsx  Klasemen, jadwal, hasil, top skor (bisa dibuka dengan ?comp=seriea|europa|coppa)
  skuad/page.tsx      Skuad Juventus; klik pemain membuka popup profil
  statistik/page.tsx  Gol & kartu pemain
  klub/page.tsx       Sejarah klub: kartu ringkas, narasi per era, kronologi
  api/
    live/             Laga yang sedang berjalan / baru selesai (timeline, susunan pemain, statistik)
    juventus/         Semua laga Juventus (+ /stats untuk statistik pemain)
    standings/        Klasemen + form 5 laga
    competition/      Semua laga satu kompetisi + top skor
    match/[id]/       Detail satu pertandingan
    squad/            Skuad (Transfermarkt, cadangan FotMob)
    player/           Detail satu pemain untuk popup (?name=Bremer): FotMob + Wikidata
    klub/             Sejarah klub (Wikipedia + Wikidata, ?club=juventus)
components/           Header, kp.tsx (komponen bersama), LiveScore.tsx, HomeWidgets.tsx
lib/                  espn.ts, juve.ts, live.ts, squad.ts, wiki.ts, clubs.ts, types.ts
```

## Sumber data

- **ESPN** (endpoint publik tidak resmi): jadwal, skor, klasemen, timeline, susunan pemain, statistik.
- **Transfermarkt JSON API** (tidak resmi): skuad, nilai pasar, kontrak, usia. Cadangan: **FotMob**.

- **FotMob playerData** (tidak resmi): tanggal lahir, riwayat klub, caps timnas, rating 10 laga terakhir, status cedera (popup pemain).
- **Wikipedia, Wikidata, Wikimedia Commons** (API resmi, gratis, tanpa kunci): halaman Klub. Teks CC BY-SA 4.0, wajib atribusi. Opsional: isi env `WIKI_CONTACT` dengan URL repo atau email supaya User-Agent sesuai kebijakan Wikimedia. Klub baru = tambah satu entri di `lib/clubs.ts`.

Semua sumber lain tidak resmi; format dan aksesnya bisa berubah atau diblokir sewaktu-waktu. Bila sumber tidak punya suatu nilai, tampilannya `–`, tidak diisi angka karangan.

## Popup profil pemain

Klik pemain di tab Skuad. Statistik (starter liga, gol, assist, kartu, profil persentil) dihitung dari data ESPN yang sama dengan halaman Statistik; persentil membandingkan dengan pemain Juventus seposisi yang sudah main minimal 180 menit. Tempat lahir dari Wikidata hanya dipakai bila tanggal lahirnya cocok persis dengan FotMob.

**Gaji** dibaca dari tabel Supabase `player_salaries` lewat `/api/gaji` (env `SUPABASE_URL`, `SUPABASE_KEY`; lihat `.env.example`). Satu request untuk seluruh tabel, di-cache 6 jam; tanpa env atau saat Supabase gagal tampil "–". **Heatmap** belum ada karena tidak ada sumber gratis yang bisa dipakai.

## Tab Kontrak, Cedera, dan Skuad

- **Skuad** (`/skuad`): dua baris kartu ringkasan (usia, cedera, gaji, nilai pasar), urutan "Gaji tertinggi", gaji per pekan di tiap kartu.
- **Kontrak** (`/kontrak`): tabel gaji, bonus, sisa kontrak, nilai pasar; klik pemain membuka popup profil.
- **Cedera** (`/cedera`): kartu pemain cedera dari status FotMob (`/api/cedera`), berita terkait sebagai tautan.
- **Lineup**: `lib/pitch.ts` menyusun baris dan urutan kiri-kanan dari kode posisi ESPN; dipakai tab Skor live dan popup rating.
- **Gaji**: tabel Supabase `player_salaries` lewat `/api/gaji`. Env: `SUPABASE_URL`+`SUPABASE_KEY` atau `NEXT_PUBLIC_SUPABASE_URL`+`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Respons kosong menyertakan `reason`.

## Halaman Women

`/women` menampilkan klasemen Serie A Women, jadwal & hasil (Serie A, Liga Champions Wanita, Coppa Italia Women), skuad per posisi, serta kartu "Tim & transfer" (pelatih, kapten, kandang, rekrutan dan pemain keluar musim ini), lewat `/api/women`.

- **Sumber utama: FotMob**, halaman tim Juventus (W), ID `956623` (bisa diganti dengan env `FOTMOB_WOMEN_TEAM_ID`). Satu request memuat tabel liga dan seluruh jadwal/hasil semua kompetisi.
- **Cadangan: ESPN**, hanya bila FotMob gagal. Slug kompetisi putri di ESPN tidak terdokumentasi dan sering tidak ada.
- Field `source` pada respons menunjukkan sumber yang dipakai, `sources` jumlah data per kompetisi, `warnings` alasan bila ada yang kosong.
- Skuad, pelatih, kapten, kandang, dan transfer dibaca dari payload FotMob yang sama (tanpa request tambahan). Kapten dan kandang hanya tampil bila FotMob menyertakannya; transfer dihitung sejak 1 Juni musim berjalan. Jalur cadangan ESPN tidak punya data ini, jadi bagian itu disembunyikan.
- FotMob tidak menyediakan nama stadion di daftar laga, jadi baris jadwal tidak menampilkan stadion.

## Halaman Akademi

`/akademi` menampilkan Juventus Next Gen, Juventus Youth (Primavera), pemain yang naik ke tim utama, dan pemain pinjaman, lewat `/api/akademi`.

- **FotMob** untuk tabel liga, jadwal & hasil, skuad, top skor, dan pemain pinjaman. ID tim: Next Gen `956184`, Youth `394206` (ganti lewat env `FOTMOB_NEXTGEN_ID` / `FOTMOB_YOUTH_ID`). Nama liga dibaca dari data, tidak ditulis tangan.
- **Pemain pinjaman** = transfer pinjaman keluar dari tim utama sejak 1 Juni musim berjalan (`transfers` di data FotMob tim utama); statistiknya dari 5 laga terakhir di klub peminjam.
- **Naik ke tim utama** = pemain skuad Next Gen/Youth yang namanya cocok ketat dengan pemain yang tercatat bermain di statistik ESPN tim utama.
- **Performa pemain Next Gen** (`/api/akademi/performa`) menjumlahkan semua laga selesai musim ini dari `matchDetails` FotMob: laga, starter, menit (dari data pergantian), gol, assist, kartu, dan rata-rata rating. Kekosongan data dijelaskan di `warnings` dan `coverage` (jumlah laga yang punya lineup/kejadian/rating). Panel "Siap naik ke tim utama?" memakai indeks buatan Matchday Hub (rumus di `lib/akademi-index.ts`), bukan penilaian klub.
- Pencetak gol per pertandingan tidak tersedia di data FotMob, jadi baris hasil tidak menampilkannya.
- `sources` pada respons API menunjukkan jumlah data per sumber; `warnings` menjelaskan bila ada yang kosong.

## Catatan

- Halaman `/juventus` sudah dihapus; tautan lama diarahkan oleh `next.config.mjs`.
- Hasil laga tetap tampil di Skor live selama 72 jam sejak kick-off (`RECENT_HOURS` di `lib/live.ts`).
- Jangan commit `.env.local`; salin `.env.example` bila diperlukan.
