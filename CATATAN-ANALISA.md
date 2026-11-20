# Tambahan Analisa + Statistik — catatan pemasangan

Semua jalur sudah mengikuti struktur rapi (`lib/<fitur>/`, `components/<fitur>/`). Salin folder `app`, `components`, `lib` ke repo (timpa).

## Hapus dari repo (duplikat, sudah digantikan `app/api/analisa/[tab]/route.ts`)
- `app/api/analisa/lawan/route.ts`
- `app/api/analisa/jadwal/route.ts`
URL `/api/analisa/lawan` dan `/api/analisa/jadwal` tetap bekerja dengan pesan galat dan header cache yang sama.

## Ditambah (13 file)
- API satu pintu: `app/api/analisa/[tab]/route.ts` → lawan, jadwal, pola, kiper, penonton, keuangan
- Tab: `components/analisa/{Kiper,Penonton,Keuangan}.tsx`
- Data: `lib/analisa/{fotmob,keuangan,kiper,penonton,pola-server}.ts`

## Dibuat ulang oleh saya (tidak ada di zip kiriman) — JANGAN menimpa bila di repo-mu sudah ada versi asli
- `lib/analisa/util.ts` — format angka (dec, int, signed, r1, minuteOf, pointsOf, DASH)
- `lib/analisa/pola.ts` — tipe PolaGame/PolaResponse + toGoals
- `lib/analisa/pemain.ts` — hanya `norm` dan `sameName` (dipakai Kiper)
- `components/analisa/ui.tsx` — Card, Tile, Empty, Logo, useTab
Jika versi aslimu sudah punya fungsi tambahan (mis. untuk tab Pola/Pemain), pertahankan versi asli; yang dipakai file baru hanya yang tercantum di atas.

## Diubah (5 file)
- `components/analisa/Analisa.tsx` — memasang tab Kiper, Penonton, Keuangan
- `components/analisa/analisa.css` — stylesheet baru + 6 aturan `kj-*` yang masih dipakai Kesulitan jadwal
- `app/statistik/page.tsx` — tab Beban menit, Statistik tim, Kartu & skorsing kini terisi (sebelumnya penanda "belum tersedia")
- `lib/pemain/playerstats.ts` — diperluas (apps, matchList, rating per laga); hanya menambah
- `components/statistik/stathub.css` — hanya menambah

## Belum dipasang — menunggu file yang tidak ada di zip
- Tab **Peringkat (koefisien UEFA)**: `Peringkat.tsx` dan `peringkat-server.ts` ada, tetapi `lib/analisa/peringkat.ts` (parser UEFA/Wikipedia) dan `http.ts` tidak. Bila sudah ada: 1) salin ke `lib/analisa/`, 2) tambahkan `import Peringkat` dan `<Peringkat />` di `Analisa.tsx` (tab `keuangan`), 3) tambahkan satu baris `peringkat: {...}` di route `[tab]` (salin dari zip asal; `debug` sudah didukung).
- Tab **Pola laga**: server (`pola-server.ts`) sudah ada, komponen `Pola.tsx` belum.
- Tab **Pemain**: `pemain.ts` lengkap, `pemain-server.ts`, dan `Pemain.tsx` belum.
