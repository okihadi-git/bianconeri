export interface CoachNation {
  code: string;
  /** nama negara dalam bahasa Indonesia, atau kode FIFA bila tidak dikenal */
  name: string;
  /** URL gambar bendera; null bila negara tidak punya bendera saat ini (mis. Yugoslavia) */
  flag: string | null;
}

export interface CoachHonour {
  label: string;
  count: number;
}

/** Satu pelatih kepala tetap (pelatih sementara tidak masuk daftar). */
export interface ManagerRow {
  /** nomor urut kronologis, 1 = pelatih tertua */
  n: number;
  name: string;
  /** judul artikel Wikipedia (untuk foto), null bila tidak punya artikel */
  wiki: string | null;
  nations: CoachNation[];
  /** mis. "2014–2019 · 2021–2024" atau "2025–sekarang" */
  period: string;
  fromYear: number | null;
  current: boolean;
  photo: string | null;
  honours: CoachHonour[];
  matches: number | null;
  winPct: number | null;
}

export interface StaffMember {
  name: string;
  role: string;
  nation: CoachNation;
  photo: string | null;
}

export interface CoachesResponse {
  club: string;
  /** mis. "2026/27" */
  season: string;
  managers: ManagerRow[];
  staff: StaffMember[];
  /** keterangan kapan daftar staf terakhir ditulis manual */
  staffAsOf: string;
  /** tanggal statistik laga di artikel Wikipedia, mis. "26 Oktober 2025" */
  statsAsOf: string | null;
  /** pelatih sementara yang tidak dihitung (untuk catatan kaki) */
  interim: { name: string; year: number }[];
  source: { title: string; url: string } | null;
  updatedAt: string;
  errors: Record<string, string>;
}
