import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Anda bisa memanggil helper internal Anda di sini jika ingin dinamai langsung dari database/lib Juventus
    // Contoh struktur data taktik yang diformat presisi untuk Juventus:
    const dataTaktik = {
      ringkasan: [
        "Thiago Motta paling sering memakai 4-2-3-1 (15 dari 16 laga), dengan variasi 4-3-3.",
        "Serangan condong ke tengah: 78% xG Juventus lahir dari koridor tersebut.",
        "Cara paling sering menciptakan peluang: umpan pendek/biasa (72% umpan kunci).",
        "Duet paling produktif: Koopmeiners → Yıldız (0,78 xG tercipta).",
        "Rata-rata xG per laga 1,75 berbanding 0,95 untuk lawan — unggul secara struktur.",
        "Bola mati menyumbang 12% dari total xG Juventus.",
        "Pressing tinggi aktif: Juventus lebih sering mendapat pelanggaran di area lawan."
      ],
      formasi: {
        utama: "4-2-3-1",
        persentase: "94%",
        laga: 15,
        alternatif: "4-3-3",
        lagaAlternatif: 1
      },
      arahSerangan: {
        kiri: { persentase: "12%", tembakan: 38, xG: 2.45, gol: 2 },
        tengah: { persentase: "76%", tembakan: 148, xG: 21.40, gol: 19 },
        kanan: { persentase: "12%", tembakan: 40, xG: 2.90, gol: 4 }
      },
      kombinasiUmpan: [
        { from: 'Teun Koopmeiners', to: 'Kenan Yıldız', count: '6x', xg: '0,74' },
        { from: 'Andrea Cambiaso', to: 'Nico González', count: '3x', xg: '0,52' },
        { from: 'Manuel Locatelli', to: 'Teun Koopmeiners', count: '5x', xg: '0,41' },
        { from: 'Khéphren Thuram', to: 'Kenan Yıldız', count: '4x', xg: '0,38' }
      ],
      pertahanan: {
        tembakanLawanPerLaga: "8,4",
        xgLawan: "0,92",
        luarKotak: "32%",
        peluangEmasLawan: 9,
        menitRawan: "61-75'"
      },
      pressing: {
        pelanggaranDiAreaLawan: "3,6",
        diberikanKeLawan: "1,6",
        rasioPressing: "1,85",
        sepakPojokPerLaga: "6,1"
      },
      bolaMati: {
        totalTembakan: 26,
        xgSetPiece: "3,42",
        gol: 3,
        pengambilUtama: "Teun Koopmeiners",
        targetUtama: "Bremer / Gatti"
      },
      previewLawan: {
        saran: [
          "Manfaatkan bola mati: Lawan rapuh dalam mengantisipasi set-piece (kebobolan 30%).",
          "Eksploitasi half-space: Titik lemah transisi bertahan lawan berada di sektor sayap.",
          "Tekan lini tengah sejak awal untuk memaksa lawan melakukan turnover."
        ]
      }
    };

    return NextResponse.json(dataTaktik);
  } catch (error) {
    return NextResponse.json({ error: "Gagal memproses data taktik" }, { status: 500 });
  }
}
