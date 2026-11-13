'use client';

import { useState } from 'react';
import AnalisaPemain from '@/components/AnalisaPemain';
import KesulitanJadwal from '@/components/KesulitanJadwal';
import LawanBerikutnya from '@/components/LawanBerikutnya';
import PolaLaga from '@/components/PolaLaga';

const TABS = [
  { key: 'lawan', label: 'Lawan berikutnya' },
  { key: 'jadwal', label: 'Kesulitan jadwal' },
  { key: 'pola', label: 'Pola laga' },
  { key: 'pemain', label: 'Pemain' },
  { key: 'kiper', label: 'Kiper' },
  { key: 'penonton', label: 'Penonton' },
  { key: 'keuangan', label: 'Peringkat & keuangan' },
] as const;

/** Statistik → Analisa. Yang sudah ada isinya: "Lawan berikutnya", "Kesulitan jadwal", "Pola laga", dan "Pemain". */
export default function Analisa() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('lawan');
  return (
    <>
      <div className="kp-tabs" role="tablist" aria-label="Analisa">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`kp-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'lawan' ? (
        <LawanBerikutnya />
      ) : tab === 'jadwal' ? (
        <KesulitanJadwal />
      ) : tab === 'pola' ? (
        <PolaLaga />
      ) : tab === 'pemain' ? (
        <AnalisaPemain />
      ) : (
        <section className="kp-card">
          <header className="kp-card-head">
            <h2 className="kp-title">{TABS.find((t) => t.key === tab)?.label}</h2>
          </header>
          <div className="kp-empty">Bagian ini belum tersedia.</div>
        </section>
      )}
    </>
  );
}
