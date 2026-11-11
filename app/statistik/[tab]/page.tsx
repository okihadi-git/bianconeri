'use client';

import React, { useEffect, useState } from 'react';

export default function BedahTaktikPage() {
  const [taktik, setTaktik] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/statistik/taktik')
      .then((res) => res.json())
      .then((data) => {
        setTaktik(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching taktik:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 font-medium">
        Memuat Analisis Bedah Taktik Juventus...
      </div>
    );
  }

  if (!taktik) {
    return <div className="py-20 text-center text-red-500">Data taktik tidak ditemukan.</div>;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Ringkasan Taktik */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Ringkasan Taktik</h2>
        <p className="text-xs text-gray-500 mb-4">Dibuat otomatis dari data musim ini</p>
        <div className="space-y-3">
          {taktik.ringkasan.map((item: string, idx: number) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-red-600 text-sm text-gray-700">
              <span className="font-bold text-red-600 w-5">{idx + 1}</span>
              <p className="flex-1">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Formasi & XI */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Formasi & XI</h2>
        <p className="text-xs text-gray-500 mb-4">Bentuk tim yang paling sering digunakan</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border">
              <p className="text-xs text-gray-500">Formasi Utama</p>
              <p className="text-xl font-bold text-gray-900">{taktik.formasi.utama} ({taktik.formasi.laga} Laga)</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border">
              <p className="text-xs text-gray-500">Formasi Alternatif</p>
              <p className="text-xl font-bold text-gray-900">{taktik.formasi.alternatif} ({taktik.formasi.lagaAlternatif} Laga)</p>
            </div>
          </div>
          <div className="bg-emerald-700 rounded-xl p-6 text-white flex items-center justify-center text-sm font-medium shadow-inner">
            Visualisasi Starting XI Sesuai Skuad Aktif Juventus
          </div>
        </div>
      </section>

      {/* 3. Arah Serangan */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Arah Serangan</h2>
        <p className="text-xs text-gray-500 mb-4">Analisis koridor serangan tim</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-gray-50 rounded-lg border">
            <p className="text-xs text-gray-500">Kiri</p>
            <p className="text-xl font-bold">{taktik.arahSerangan.kiri.persentase}</p>
          </div>
          <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-xs text-red-600 font-semibold">Tengah (Dominan)</p>
            <p className="text-2xl font-bold text-red-700">{taktik.arahSerangan.tengah.persentase}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border">
            <p className="text-xs text-gray-500">Kanan</p>
            <p className="text-xl font-bold">{taktik.arahSerangan.kanan.persentase}</p>
          </div>
        </div>
      </section>

      {/* 4. Jaringan Umpan Kunci */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Jaringan Umpan Kunci</h2>
        <p className="text-xs text-gray-500 mb-4">Kombinasi operan paling berbahaya</p>
        <div className="space-y-3">
          {taktik.kombinasiUmpan.map((combo: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm border">
              <span className="font-medium text-gray-800">{combo.from} → {combo.to}</span>
              <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
                <span>{combo.count} peluang</span>
                <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded">xG {combo.xg}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Pertahanan */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Pertahanan</h2>
        <p className="text-xs text-gray-500 mb-4">Statistik blok dan kebobolan</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-red-600 text-white p-4 rounded-xl shadow-sm">
            <p className="text-xs opacity-80">Tembakan Lawan / Laga</p>
            <p className="text-2xl font-bold mt-1">{taktik.pertahanan.tembakanLawanPerLaga}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border">
            <p className="text-xs text-gray-500">Dari Luar Kotak</p>
            <p className="text-2xl font-bold">{taktik.pertahanan.luarKotak}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border">
            <p className="text-xs text-gray-500">Peluang Emas Lawan</p>
            <p className="text-2xl font-bold">{taktik.pertahanan.peluangEmasLawan}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border">
            <p className="text-xs text-gray-500">Menit Rawan</p>
            <p className="text-xl font-bold text-red-600">{taktik.pertahanan.menitRawan}</p>
          </div>
        </div>
      </section>

      {/* 6. Pressing */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Pressing</h2>
        <p className="text-xs text-gray-500 mb-4">Intensitas tekanan tinggi</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-xl text-center border">
            <p className="text-xs text-gray-500">Pelanggaran di Area Lawan</p>
            <p className="text-xl font-bold">{taktik.pressing.pelanggaranDiAreaLawan}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl text-center border">
            <p className="text-xs text-gray-500">Rasio Pressing</p>
            <p className="text-xl font-bold">{taktik.pressing.rasioPressing}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl text-center border">
            <p className="text-xs text-gray-500">Sepak Pojok / Laga</p>
            <p className="text-xl font-bold">{taktik.pressing.sepakPojokPerLaga}</p>
          </div>
        </div>
      </section>

      {/* 7. Rutinitas Bola Mati */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Rutinitas Bola Mati</h2>
        <p className="text-xs text-gray-500 mb-4">Eksekutor dan target set-piece</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-600 text-white p-4 rounded-xl shadow-sm">
            <p className="text-xs opacity-80">Tembakan Set-Piece</p>
            <p className="text-2xl font-bold mt-1">{taktik.bolaMati.totalTembakan} ({taktik.bolaMati.gol} Gol)</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border">
            <p className="text-xs text-gray-500">Pengambil Utama</p>
            <p className="text-lg font-bold">{taktik.bolaMati.pengambilUtama}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border">
            <p className="text-xs text-gray-500">Target Utama Kotak</p>
            <p className="text-lg font-bold">{taktik.bolaMati.targetUtama}</p>
          </div>
        </div>
      </section>

      {/* 8. Preview Taktik Lawan */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Preview Taktik Lawan</h2>
        <p className="text-xs text-gray-500 mb-4">Analisis celah calon lawan berikutnya</p>
        <div className="space-y-3">
          {taktik.previewLawan.saran.map((saran: string, i: number) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border-l-4 border-red-600 border">
              {saran}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
