'use client';

import { useState } from 'react';
import './face.css';

const initials = (n: string) => {
  const t = n.trim().split(/\s+/).filter(Boolean);
  return (t.length < 2 ? (t[0] ?? '?').slice(0, 2) : t[0][0] + t[t.length - 1][0]).toUpperCase();
};

/** Foto pemain bulat (FotMob). Kalau tidak ada / gagal dimuat: `fallback` (mis. nomor punggung) atau inisial. */
export default function Face({ src, name, size = 36, fallback }: { src?: string; name: string; size?: number; fallback?: string }) {
  const [bad, setBad] = useState(false);
  if (src && !bad) {
    return <img src={src} alt="" className="fc" style={{ width: size, height: size }} loading="lazy" onError={() => setBad(true)} />;
  }
  return (
    <span className="fc fc-ph" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {fallback ?? initials(name)}
    </span>
  );
}
