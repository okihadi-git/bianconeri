# Bianconeri Matchday Hub

Aplikasi Next.js untuk dashboard Juventus: skor dan detail pertandingan, ringkasan kompetisi, klasemen, jadwal gabungan, skuad, dan statistik.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Sumber data

Data sepak bola diambil dari endpoint publik ESPN yang tidak resmi dan tidak memerlukan API key. Endpoint ini tidak memiliki SLA; sebagian statistik, susunan pemain, atau data Coppa Italia dapat kosong jika ESPN tidak menyediakan data untuk event/kompetisi tersebut. Seluruh waktu di UI ditampilkan dalam WIB.
