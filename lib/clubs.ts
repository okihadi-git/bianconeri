// Konfigurasi per klub untuk halaman /klub.
// Menambah klub baru = menambah satu entri di CLUBS (tanpa database).
//
// Yang diambil otomatis dari API gratis:
//   - Wikipedia (narasi sejarah, per era)         -> lib/wiki.ts
//   - Wikidata  (tahun berdiri, kandang, pemilik) -> lib/wiki.ts
// Yang ditulis manual di sini (tidak ada sumber terstruktur yang bersih):
//   - kronologi singkat, catatan di bawah kartu, kartu "kasta", foto (opsional)

export interface TimelineItem {
  year: string;
  /** **teks** = tebal */
  text: string;
}

export interface ClubConfig {
  slug: string;
  name: string;
  /** Artikel utama klub di en.wikipedia; dipakai hanya untuk mencari ID Wikidata. */
  wikiMain: string;
  /** Artikel yang dicoba berurutan untuk narasi sejarah. Bahasa Indonesia dicoba lebih dulu. */
  history: { id: string[]; en: string[] };
  foundedNote: string;
  ownerNote: string;
  tier: { label: string; value: string; sub: string };
  /** Opsional: nama berkas di Wikimedia Commons, mis. "File:Nama berkas.jpg". Tanpa ini, bagian narasi tampil tanpa foto. */
  photo?: { file: string; caption: string };
  timeline: TimelineItem[];
}

export const CLUBS: Record<string, ClubConfig> = {
  juventus: {
    slug: 'juventus',
    name: 'Juventus',
    wikiMain: 'Juventus F.C.',
    history: {
      id: ['Sejarah Juventus F.C.', 'Juventus F.C.'],
      en: ['History of Juventus F.C.', 'Juventus F.C.'],
    },
    foundedNote: 'Sebagai Sport Club Juventus, di Turin',
    ownerNote: 'Keluarga Agnelli memimpin klub sejak 1923',
    tier: {
      label: 'Di kasta tertinggi',
      value: 'Serie A',
      sub: 'Kecuali musim 2006/07 di Serie B (Calciopoli)',
    },
    timeline: [
      { year: '1897', text: 'Sekelompok pelajar Turin mendirikan **Sport Club Juventus** pada 1 November.' },
      { year: '1900', text: 'Mulai ikut **kejuaraan nasional Italia**.' },
      { year: '1903', text: 'Mengganti kostum merah muda menjadi **garis hitam-putih**, terinspirasi Notts County.' },
      { year: '1905', text: 'Meraih **Scudetto** pertama.' },
      { year: '1923', text: '**Edoardo Agnelli** menjadi presiden; keluarga Agnelli mulai memimpin klub.' },
      { year: '1931', text: 'Awal **lima Scudetto beruntun** (1931–1935), yang dikenal sebagai Quinquennio d’Oro.' },
      { year: '1958', text: 'Meraih Scudetto ke-10 dan memasang **bintang pertama** di kostum.' },
      { year: '1985', text: 'Juara **Piala Champions**, di final yang dibayangi tragedi Heysel.' },
      { year: '1996', text: 'Juara **Liga Champions** setelah mengalahkan Ajax lewat adu penalti di Roma.' },
      { year: '2006', text: 'Skandal **Calciopoli**: dicopot dari gelar 2004/05 dan 2005/06, lalu **terdegradasi ke Serie B**. Naik lagi pada 2007.' },
      { year: '2011', text: 'Pindah ke **Juventus Stadium** (kini Allianz Stadium) dan memulai **sembilan Scudetto beruntun** hingga 2020.' },
    ],
  },
};
