'use client';

import { useState } from 'react';
import { useFetch } from '@/components/kp';
import type { TaktikResponse } from '@/lib/taktik-server';
import './taktik.css';

const SECTIONS = [
  { key: 'ringkasan', icon: '📝', label: 'Ringkasan taktik' },
  { key: 'formasi', icon: '🧩', label: 'Formasi & XI' },
  { key: 'serangan', icon: '↗️', label: 'Arah serangan' },
  { key: 'umpan', icon: '⚛️', label: 'Jaringan umpan kunci' },
  { key: 'pertahanan', icon: '🛡️', label: 'Pertahanan' },
  { key: 'pressing', icon: '⚡', label: 'Pressing' },
  { key: 'bolamati', icon: '🚩', label: 'Rutinitas bola mati' },
  { key: 'lawan', icon: '🔍', label: 'Preview taktik lawan' },
] as const;

/** "teks **tebal** teks" → node React */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))}
    </>
  );
}

/** Statistik → Bedah Taktik. Baru "Ringkasan taktik" yang sudah ada isinya. */
export default function BedahTaktik() {
  const [sec, setSec] = useState<(typeof SECTIONS)[number]['key']>('ringkasan');
  const res = useFetch<TaktikResponse>(sec === 'ringkasan' ? '/api/statistik/taktik' : null);
  const cur = SECTIONS.find((s) => s.key === sec)!;
  const d = res.data;

  return (
    <div className="bt">
      <nav className="bt-nav" aria-label="Bagian bedah taktik">
        {SECTIONS.map((s) => (
          <button key={s.key} type="button" className={`bt-chip${sec === s.key ? ' on' : ''}`} aria-current={sec === s.key ? 'true' : undefined} onClick={() => setSec(s.key)}>
            <span aria-hidden>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </nav>

      <section className="bt-card">
        <header className="bt-head">
          <span className="bt-ico" aria-hidden>
            {cur.icon}
          </span>
          <h2>{cur.label}</h2>
          {sec === 'ringkasan' ? <small>Dibuat otomatis dari data musim ini</small> : null}
        </header>

        {sec !== 'ringkasan' ? <div className="bt-empty">Bagian ini belum tersedia.</div> : null}
        {sec === 'ringkasan' && res.loading ? <div className="bt-empty">Memuat ringkasan taktik… (pertama kali bisa beberapa detik)</div> : null}
        {sec === 'ringkasan' && !res.loading && (res.error || !d) ? <div className="bt-empty">Data taktik belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}
        {sec === 'ringkasan' && d && !res.loading ? (
          d.ringkasan.length ? (
            <>
              <ol className="bt-list">
                {d.ringkasan.map((t, i) => (
                  <li key={i}>
                    <em>{i + 1}</em>
                    <p>
                      <Rich text={t} />
                    </p>
                  </li>
                ))}
              </ol>
              <p className="bt-note">
                Sumber: FotMob, {d.matches} laga selesai.
                {d.warnings.map((w) => ` ${w}`).join('')}
              </p>
            </>
          ) : (
            <div className="bt-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
          )
        ) : null}
      </section>
    </div>
  );
}
