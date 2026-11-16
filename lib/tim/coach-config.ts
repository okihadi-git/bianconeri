// Konfigurasi halaman Pelatih per klub. Menambah klub = tambah satu entri.
//
// Otomatis (Wikipedia, tanpa kunci API): daftar pelatih kepala + tahun + jumlah trofi + foto.
// Manual (tidak ada sumber terstruktur yang gratis): staf asisten pelatih.

export interface StaffConfig {
  name: string;
  role: string;
  /** kode negara FIFA, mis. "ITA" */
  code: string;
  /** judul artikel Wikipedia (en) untuk foto; kosongkan bila tidak ada artikel */
  wiki?: string;
}

export interface CoachSource {
  slug: string;
  clubName: string;
  /** artikel daftar pelatih di en.wikipedia */
  listTitle: string;
  staff: StaffConfig[];
  /** kapan daftar staf terakhir dicek, tampil di catatan kaki */
  staffAsOf: string;
}

export const COACH_SOURCES: Record<string, CoachSource> = {
  juventus: {
    slug: 'juventus',
    clubName: 'Juventus',
    listTitle: 'List of Juventus FC managers',
    // Staf yang dibawa Luciano Spalletti saat ditunjuk (30 Okt 2025), menurut pengumuman/pemberitaan media.
    // Staf klub lainnya (pelatih kiper, tim medis, analis) tidak tercantum. Perbarui bila ada perubahan.
    staffAsOf: '30 Oktober 2025',
    staff: [
      { name: 'Marco Domenichini', role: 'Asisten pelatih', code: 'ITA', wiki: 'Marco Domenichini' },
      { name: 'Giovanni Martusciello', role: 'Asisten teknik', code: 'ITA', wiki: 'Giovanni Martusciello' },
      { name: 'Salvatore Russo', role: 'Asisten teknik', code: 'ITA' },
      { name: 'Francesco Sinatti', role: 'Pelatih fisik', code: 'ITA' },
    ],
  },
};
