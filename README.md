# Bianconeri Matchday Hub

## Struktur halaman

- `app/page.tsx` — Beranda: live score/hasil terbaru, ringkasan kompetisi, pertandingan berikutnya, dan jadwal gabungan.
- `app/kompetisi/page.tsx` — Halaman kompetisi.
- `app/skuad/page.tsx` — Halaman skuad Juventus.
- `app/statistik/page.tsx` — Halaman statistik Juventus.
- `components/Header.tsx` — Navigasi utama.
- `components/kp.tsx` — Komponen bersama (klasemen, pencetak gol, form, dan utilitas data).
- `lib/espn.ts` — Integrasi sumber data ESPN.
- `lib/types.ts` — Tipe data.
- `app/api/` — Endpoint API internal aplikasi.

## Yang berubah

- Menu/halaman Juventus tersendiri dihapus dari navigasi.
- Ringkasan Juventus berada di Beranda.
- Skuad berada di `/skuad`.
- Statistik berada di `/statistik`.
- API Juventus dipertahankan karena masih digunakan oleh Beranda dan Statistik.

## Catatan saat memperbarui GitHub

Jika repository GitHub masih memiliki file lama `app/juventus/page.tsx`, hapus file tersebut setelah menyalin perubahan ini. Pastikan folder `app/juventus/` tidak lagi berisi `page.tsx`. Jangan hapus `app/api/juventus/` atau `app/api/juventus/stats/` karena itu endpoint API, bukan halaman.

Root Directory Vercel harus menunjuk ke folder yang berisi `package.json`.
