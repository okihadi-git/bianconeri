'use client';

import { useState } from 'react';
import type { SquadPlayer } from '@/lib/types';

/** €12,5 jt / €800 rb */
export function fmtEuro(n: number | null) {
  if (n == null) return '–';
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace('.', ',')} jt`;
  return `€${Math.round(n / 1000)} rb`;
}

/** "Jun 2027" dari tanggal ISO (UTC) */
export function fmtMonthYear(iso: string | null) {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** Sisa bulan (dibulatkan) dari sekarang sampai tanggal ISO; null bila tanggal tidak valid. */
export function monthsLeft(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now) / (30.44 * 86_400_000));
}

/** "2 th 3 bln" / "7 bln" / "Habis" */
export function fmtLeft(months: number | null) {
  if (months == null) return '–';
  if (months <= 0) return 'Habis';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} th` : '', m ? `${m} bln` : ''].filter(Boolean).join(' ');
}

/** Foto pemain; kalau tak ada/gagal dimuat, lingkaran bernomor punggung. */
export function PlayerAvatar({ p }: { p: SquadPlayer }) {
  const [broken, setBroken] = useState(false);
  if (p.photo && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.photo} alt="" className="sq-photo" loading="lazy" onError={() => setBroken(true)} />;
  }
  return <span className="kp-jersey">{p.jersey || '–'}</span>;
}
