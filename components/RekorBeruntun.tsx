'use client';

import { useFetch } from '@/components/kp';
import type { RekorResponse, StreakCard } from '@/lib/rekor';
import './rekor.css';

const LETTER = { M: 'M', S: 'S', K: 'K' } as const;
const WORD = { M: 'menang', S: 'seri', K: 'kalah' } as const;

function Card({ c }: { c: StreakCard }) {
  const pct = c.best > 0 ? Math.round((c.now / c.best) * 100) : 0;
  return (
    <div className="rk-card">
      <b className="rk-num">{c.now}</b>
      <div className="rk-body">
        <strong>{c.label}</strong>
        <span>
          {c.now > 0 ? 'sedang berjalan' : 'tidak sedang berjalan'} · rekor musim ini {c.best}
        </span>
        <div className="rk-bar" role="img" aria-label={`${c.now} dari rekor ${c.best}`}>
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Statistik → Analitik → 08 Rekor beruntun. */
export default function RekorBeruntun() {
  const res = useFetch<RekorResponse>('/api/analitik/rekor');
  const d = res.data;
  const t = d?.target ?? null;
  const targetPct = t ? Math.min(100, Math.round((t.wins / t.goal) * 100)) : 0;

  return (
    <section className="rk">
      <header className="rk-head">
        <span className="rk-numtag">08</span>
        <h2>REKOR BERUNTUN</h2>
        <small>Rentetan musim ini</small>
      </header>

      {res.loading ? <div className="rk-empty">Memuat rekor… (pertama kali bisa beberapa detik)</div> : null}
      {!res.loading && (res.error || !d) ? <div className="rk-empty">Data belum bisa dimuat. Coba muat ulang beberapa saat lagi.</div> : null}

      {d && !res.loading ? (
        d.total === 0 ? (
          <div className="rk-empty">{d.warnings[0] ?? 'Belum ada data.'}</div>
        ) : (
          <>
            <div className="rk-form" role="list" aria-label="Hasil semua laga resmi musim ini">
              {d.chips.map((m) => (
                <span key={m.id} role="listitem" className={`rk-chip ${m.result}`} title={`${m.home ? 'vs' : '@'} ${m.opp} ${m.score} · ${m.comp}`} aria-label={`${WORD[m.result]} ${m.home ? 'melawan' : 'di kandang'} ${m.opp} ${m.score}`}>
                  {LETTER[m.result]}
                </span>
              ))}
            </div>
            <p className="rk-cap">Semua laga resmi musim ini, kiri = paling awal.</p>

            <div className="rk-cards">
              {d.cards.map((c) => (
                <Card key={c.key} c={c} />
              ))}
            </div>

            {t ? (
              <div className="rk-target">
                <span className="rk-tlabel">🏆 Target rekor {t.season}</span>
                <div className="rk-tbar" role="img" aria-label={`${t.wins} dari ${t.goal} kemenangan Serie A`}>
                  <i style={{ width: `${targetPct}%` }} />
                </div>
                <b className="rk-tcount">
                  {t.wins} / {t.goal} kemenangan {d.leagueName ?? 'Serie A'}
                </b>
                <small className="rk-tsub">
                  {t.reachable ? (t.need === 0 ? 'Rekor sudah disamai.' : `Butuh ${t.need} kemenangan lagi dari ${t.left} laga tersisa.`) : `Sisa ${t.left} laga tidak cukup lagi untuk menyamai rekor (butuh ${t.need} kemenangan).`}
                </small>
              </div>
            ) : null}

            <p className="rk-note">
              Rekor kemenangan terbanyak dalam satu musim Serie A: Juventus {t?.season ?? '2013/14'}, 33 kemenangan dari 38 laga. Rentetan dihitung dari skor akhir tiap laga resmi (liga, Eropa, dan piala); adu penalti dihitung seri. Sumber: FotMob.
              {d.warnings.map((w) => ` ${w}`).join('')}
            </p>
          </>
        )
      ) : null}
    </section>
  );
}
