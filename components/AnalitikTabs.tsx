'use client';

import { useEffect, useState } from 'react';
import Kreator from '@/components/Kreator';
import Penyelesaian from '@/components/Penyelesaian';
import SituasiSkor from '@/components/SituasiSkor';
import Pengganti from '@/components/Pengganti';
import BolaMati from '@/components/BolaMati';
import Penguasaan from '@/components/Penguasaan';
import RekorBeruntun from '@/components/RekorBeruntun';
import JadwalPadat from '@/components/JadwalPadat';
import MusimIniVsLalu from '@/components/MusimIniVsLalu';
import ProfilSkuad from '@/components/ProfilSkuad';
import './analitik-tabs.css';

/** Sub-tab di dalam Statistik → Analitik. Satu entri per section; tambah section baru cukup menambah satu baris di sini. */
const SECTIONS = [
  { id: 'peluang-diciptakan', num: '01', label: 'Peluang Diciptakan', View: Kreator },
  { id: 'penyelesaian', num: '02', label: 'Penyelesaian', View: Penyelesaian },
  { id: 'situasi-skor', num: '03', label: 'Situasi Skor', View: SituasiSkor },
  { id: 'pemain-pengganti', num: '04', label: 'Pemain Pengganti', View: Pengganti },
  { id: 'bola-mati', num: '05', label: 'Bola Mati', View: BolaMati },
  { id: 'penguasaan-bola', num: '06', label: 'Penguasaan Bola', View: Penguasaan },
  { id: 'rekor-beruntun', num: '08', label: 'Rekor Beruntun', View: RekorBeruntun },
  { id: 'jadwal-padat', num: '09', label: 'Jadwal Padat', View: JadwalPadat },
  { id: 'musim-ini-vs-lalu', num: '10', label: 'Musim Ini vs Lalu', View: MusimIniVsLalu },
  { id: 'profil-skuad', num: '11', label: 'Profil Skuad', View: ProfilSkuad },
] as const;

type Id = (typeof SECTIONS)[number]['id'];
const fromHash = (): Id => {
  const h = typeof window === 'undefined' ? '' : window.location.hash.replace('#', '');
  return SECTIONS.find((s) => s.id === h)?.id ?? SECTIONS[0].id;
};

export default function AnalitikTabs() {
  const [active, setActive] = useState<Id>(SECTIONS[0].id);

  // Tautan langsung, mis. /statistik/analitik#penyelesaian
  useEffect(() => {
    setActive(fromHash());
    const onHash = () => setActive(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const pick = (id: Id) => {
    setActive(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  const View = SECTIONS.find((s) => s.id === active)!.View;

  return (
    <>
      <div className="an-tabs" role="tablist" aria-label="Bagian analitik">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" role="tab" id={`an-tab-${s.id}`} aria-selected={active === s.id} aria-controls="an-panel" className={`an-tab${active === s.id ? ' on' : ''}`} onClick={() => pick(s.id)}>
            <span>{s.num}</span>
            {s.label}
          </button>
        ))}
      </div>
      <div id="an-panel" role="tabpanel" aria-labelledby={`an-tab-${active}`}>
        <View />
      </div>
    </>
  );
}
