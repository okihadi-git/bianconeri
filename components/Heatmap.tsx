'use client';

import { useEffect, useRef } from 'react';
import { useFetch } from '@/components/kp';
import type { HeatmapResponse } from '@/lib/heatmap';
import './heatmap.css';

const W = 840; // 105 × 8
const H = 544; // 68 × 8
const K = 8;
const STOPS: [number, [number, number, number]][] = [
  [0, [27, 58, 138]],
  [0.25, [47, 111, 219]],
  [0.5, [47, 191, 113]],
  [0.7, [255, 199, 44]],
  [0.85, [255, 122, 26]],
  [1, [229, 37, 42]],
];

function colorAt(t: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const f = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * f)) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/** Titik-titik sentuhan → kepadatan (gradasi radial menumpuk) → diwarnai dari biru sampai merah. */
function paint(canvas: HTMLCanvasElement, points: [number, number][]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const o = off.getContext('2d');
  if (!o) return;

  const r = 6 * K;
  for (const [px, py] of points) {
    const x = px * K;
    const y = py * K;
    const g = o.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = g;
    o.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const src = o.getImageData(0, 0, W, H);
  let max = 1;
  for (let i = 3; i < src.data.length; i += 4) if (src.data[i] > max) max = src.data[i];

  const out = ctx.createImageData(W, H);
  for (let i = 0; i < src.data.length; i += 4) {
    const t = src.data[i + 3] / max;
    if (t < 0.08) continue; // tepi sangat tipis dibiarkan transparan
    const [R, G, B] = colorAt(t);
    out.data[i] = R;
    out.data[i + 1] = G;
    out.data[i + 2] = B;
    out.data[i + 3] = Math.round(255 * Math.min(0.9, 0.25 + t));
  }
  ctx.clearRect(0, 0, W, H);
  ctx.putImageData(out, 0, 0);
}

function Pitch() {
  // Garis lapangan 105 × 68 m
  return (
    <svg viewBox="0 0 105 68" className="hm-pitch" aria-hidden>
      <rect x="0" y="0" width="105" height="68" className="hm-grass" />
      <g className="hm-lines">
        <rect x="0.5" y="0.5" width="104" height="67" />
        <line x1="52.5" y1="0.5" x2="52.5" y2="67.5" />
        <circle cx="52.5" cy="34" r="9.15" />
        <rect x="0.5" y="13.84" width="16.5" height="40.32" />
        <rect x="88" y="13.84" width="16.5" height="40.32" />
        <rect x="0.5" y="24.84" width="5.5" height="18.32" />
        <rect x="99" y="24.84" width="5.5" height="18.32" />
        <circle cx="52.5" cy="34" r="0.4" />
        <circle cx="11" cy="34" r="0.4" />
        <circle cx="94" cy="34" r="0.4" />
      </g>
    </svg>
  );
}

export default function Heatmap({ name }: { name: string }) {
  const res = useFetch<HeatmapResponse>(`/api/player/heatmap?name=${encodeURIComponent(name)}`);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (res.data && ref.current) paint(ref.current, res.data.points);
  }, [res.data]);

  // Tidak ada data (FotMob menolak / laga tanpa heatmap): bagian ini disembunyikan, bukan diisi gambar kosong.
  if (res.error || (!res.loading && !res.data)) return null;

  return (
    <section className="pm-sec">
      <h4 className="pm-h">
        Heatmap
        {res.data && (
          <span>
            {res.data.matches} laga terakhir · arah serangan →
          </span>
        )}
      </h4>
      {res.loading ? (
        <p className="pm-muted">Memuat heatmap…</p>
      ) : (
        <>
          <div className="hm-wrap">
            <Pitch />
            <canvas ref={ref} width={W} height={H} className="hm-canvas" role="img" aria-label={`Heatmap ${name}`} />
          </div>
          <p className="hm-note">
            Dari sentuhan bola di {res.data?.matches} dari {res.data?.tried} laga terakhir yang dimainkan (semua kompetisi, termasuk timnas), bukan seluruh musim. Sumber: FotMob.
          </p>
        </>
      )}
    </section>
  );
}
