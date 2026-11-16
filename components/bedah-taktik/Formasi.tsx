'use client';

import { useFetch } from '@/components/shared/kp';
import type { XiPlayer } from '@/lib/bedah-taktik/formasi';
import type { FormasiResponse } from '@/lib/bedah-taktik/formasi-server';
import './taktik.css';

const PARTICLES = new Set(['di', 'de', 'da', 'del', 'della', 'van', 'von', 'dos', 'das', 'la', 'le', 'lo', 'el', 'al', 'ter', 'ten']);

/** Nama belakang untuk label di lapangan ("Federico Gatti" → "Gatti", "Michele Di Gregorio" → "Di Gregorio"). */
function shortName(n: string) {
  const t = n.trim().split(/\s+/);
  if (t.length >= 3 && PARTICLES.has(t[t.length - 2].toLowerCase())) return `${t[t.length - 2]} ${t[t.length - 1]}`;
  return t[t.length - 1] ?? n;
}

// Lapangan vertikal 68 × 105 m, menyerang ke atas.
const W = 68;
const H = 105;

function Pitch({ xi }: { xi: XiPlayer[] }) {
  const stripes = Array.from({ length: 10 }, (_, i) => i);
  const box = (top: boolean) => {
    const y0 = top ? 0 : H;
    const s = top ? 1 : -1;
    const x = (w: number) => (W - w) / 2;
    return (
      <g>
        <rect x={x(40.32)} y={top ? 0 : H - 16.5} width="40.32" height="16.5" />
        <rect x={x(18.32)} y={top ? 0 : H - 5.5} width="18.32" height="5.5" />
        <circle cx={W / 2} cy={y0 + s * 11} r="0.5" className="dot" />
        <path d={`M ${W / 2 - 7.31} ${y0 + s * 16.5} A 9.15 9.15 0 0 ${top ? 0 : 1} ${W / 2 + 7.31} ${y0 + s * 16.5}`} />
      </g>
    );
  };
  return (
    <svg className="bt-pitch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="XI paling sering Juventus">
      <rect width={W} height={H} className="turf" />
      {stripes.map((i) => (
        <rect key={i} x="0" y={(i * H) / 10} width={W} height={H / 10} className={i % 2 ? 'stripe' : 'stripe alt'} />
      ))}
      <g className="line">
        <rect x="0.3" y="0.3" width={W - 0.6} height={H - 0.6} />
        <line x1="0.3" x2={W - 0.3} y1={H / 2} y2={H / 2} />
        <circle cx={W / 2} cy={H / 2} r="9.15" />
        <circle cx={W / 2} cy={H / 2} r="0.5" className="dot" />
        {box(true)}
        {box(false)}
      </g>
      {xi.map((p) => {
        const cx = (p.x / 100) * W;
        const cy = (p.y / 100) * H;
        return (
          <g key={p.id}>
            <title>{`${p.name} · ${p.starts} laga sebagai starter · ${p.position || '–'}`}</title>
            <circle cx={cx} cy={cy} r="3.6" className="pl" />
            <text x={cx} y={cy + 1.5} textAnchor="middle" className="no">
              {p.starts}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" className="nm">
              {shortName(p.name)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Isi bagian "Formasi & XI" (kerangka kartu dan judul disediakan BedahTaktik). */
export default function Formasi() {
  const res = useFetch<FormasiResponse>('/api/statistik/formasi');
  const d = res.data;

  if (res.loading) return <div className="bt-empty">Memuat formasi dan lineup dari semua laga musim ini… (pertama kali bisa beberapa detik)</div>;
  if (res.error || !d) return <div className="bt-empty">Data formasi belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div>;
  if (!d.matches) return <div className="bt-empty">{d.warnings[0] ?? 'Belum ada data formasi.'}</div>;

  return (
    <>
      <div className="bt-two">
        <div>
          <h3 className="bt-h3">Formasi yang dipakai</h3>
          <ul className="bt-forms">
            {d.formations.map((f) => (
              <li key={f.formation}>
                <b>{f.formation}</b>
                <i>
                  <u style={{ width: `${(f.matches / d.matches) * 100}%` }} />
                </i>
                <span>{f.matches} laga</span>
              </li>
            ))}
          </ul>
          <p className="bt-note bt-note-flat">Formasi awal dari data ESPN tiap laga resmi musim ini.</p>
        </div>
        <div>
          <h3 className="bt-h3">XI paling sering{d.main ? ` · ${d.main}` : ''}</h3>
          <Pitch xi={d.xi} />
          <p className="bt-note bt-note-flat">Angka = jumlah laga sebagai starter. Posisi = posisi paling sering pemain itu di formasi {d.main}.</p>
        </div>
      </div>
      {d.warnings.length > 0 && <p className="bt-note">{d.warnings.join(' ')}</p>}
    </>
  );
}
