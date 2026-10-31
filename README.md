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
  skuad/page.tsx      Skuad Juventus
  statistik/page.tsx  Gol & kartu pemain
  klub/page.tsx       Sejarah klub: kartu ringkas, narasi per era, kronologi
  api/
    live/             Laga yang sedang berjalan / baru selesai (timeline, susunan pemain, statistik)
    juventus/         Semua laga Juventus (+ /stats untuk statistik pemain)
    standings/        Klasemen + form 5 laga
    competition/      Semua laga satu kompetisi + top skor
    match/[id]/       Detail satu pertandingan
    squad/            Skuad (Transfermarkt, cadangan FotMob)
    klub/             Sejarah klub (Wikipedia + Wikidata, ?club=juventus)
components/           Header, kp.tsx (komponen bersama), LiveScore.tsx, HomeWidgets.tsx
lib/                  espn.ts, juve.ts, live.ts, squad.ts, wiki.ts, clubs.ts, types.ts
```

## Sumber data

- **ESPN** (endpoint publik tidak resmi): jadwal, skor, klasemen, timeline, susunan pemain, statistik.
- **Transfermarkt JSON API** (tidak resmi): skuad, nilai pasar, kontrak, usia. Cadangan: **FotMob**.

- **Wikipedia, Wikidata, Wikimedia Commons** (API resmi, gratis, tanpa kunci): halaman Klub. Teks CC BY-SA 4.0, wajib atribusi. Opsional: isi env `WIKI_CONTACT` dengan URL repo atau email supaya User-Agent sesuai kebijakan Wikimedia. Klub baru = tambah satu entri di `lib/clubs.ts`.

Semua sumber lain tidak resmi; format dan aksesnya bisa berubah atau diblokir sewaktu-waktu. Bila sumber tidak punya suatu nilai, tampilannya `–`, tidak diisi angka karangan.

## Catatan

- Halaman `/juventus` sudah dihapus; tautan lama diarahkan oleh `next.config.mjs`.
- Hasil laga tetap tampil di Skor live selama 72 jam sejak kick-off (`RECENT_HOURS` di `lib/live.ts`).
- Jangan commit `.env.local`; salin `.env.example` bila diperlukan.
