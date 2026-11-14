'use client';

import { useState } from 'react';
import Jadwal from './Jadwal';
import Kiper from './Kiper';
import Lawan from './Lawan';
import Pemain from './Pemain';
import Penonton from './Penonton';
import Peringkat from './Peringkat';
import Pola from './Pola';
import './analisa.css';

const TABS = [
  { key: 'lawan', label: 'Lawan berikutnya', View: Lawan },
  { key: 'jadwal', label: 'Kesulitan jadwal', View: Jadwal },
  { key: 'pola', label: 'Pola laga', View: Pola },
  { key: 'pemain', label: 'Pemain', View: Pemain },
  { key: 'kiper', label: 'Kiper', View: Kiper },
  { key: 'penonton', label: 'Penonton', View: Penonton },
  { key: 'peringkat', label: 'Peringkat & keuangan', View: Peringkat },
] as const;

/** Statistik → Analisa: tujuh sub-tab, semuanya terisi. Tiap tab mengambil datanya dari /api/analisa/{key}. */
export default function Analisa() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('lawan');
  const { View } = TABS.find((t) => t.key === tab) ?? TABS[0];
  return (
    <>
      <div className="kp-tabs" role="tablist" aria-label="Analisa">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`kp-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <View />
    </>
  );
}
