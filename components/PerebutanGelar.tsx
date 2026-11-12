'use client';

import { useMemo, useState } from 'react';
import { useFetch } from '@/components/kp';
import { scenario, type GelarFixture, type GelarTeam } from '@/lib/gelar';
import type { GelarResponse } from '@/lib/gelar-server';
import './gelar.css';

/** Jumlah klub pembanding yang boleh dipilih selain Juventus. */
const MAX_RIVALS = 3;
/** Jumlah klub pada daftar "Bandingkan dengan". */
const CHIP_COUNT = 8;

const isJuve = (t: GelarTeam) => t.name.includes('Juventus');
const fmtDate = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso));
const dec = (n: number) => n.toFixed(2).replace('.', ',');
const LEVEL_TEXT = { mudah: 'mudah', sedang: 'sedang', berat: 'berat' } as const;

function Logo({ src, size = 22 }: { src: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="gl-logo" width={size} height={size} loading="lazy" /> : <span className="gl-logo" style={{ width: size, height: size }} />;
}

function TeamCard({ t, byId, compare, hero }: { t: GelarTeam; byId: Map<string, GelarTeam>; compare: Set<string>; hero?: boolean }) {
  const next = t.fixtures.slice(0, 8);
  return (
    <article className={`gl-card${hero ? ' hero' : ''}`}>
      <header>
        <Logo src={t.logo} size={40} />
        <div>
          <b>{t.name}</b>
          <small>#{t.position} · {t.points} poin · {t.played} laga</small>
        </div>
      </header>
      <dl>
        <div><dt>Proyeksi akhir</dt><dd><b>{Math.round(t.proj)}</b> poin</dd></div>
        <div><dt>Poin maksimal</dt><dd className="blue">{t.max}</dd></div>
        <div>
          <dt>Sisa jadwal</dt>
          <dd><span className={`gl-badge gl-${t.level}`}>{t.level}</span></dd>
        </div>
      </dl>
      <p className="gl-diff">#{t.diffRank} terberat dari {byIdCount(byId)} · rata-rata {dec(t.avgD)} poin/laga</p>
      <ul className="gl-fx">
        {next.map((f: GelarFixture) => {
          const opp = byId.get(f.opp);
          const versus = compare.has(f.opp);
          return (
            <li key={`${f.iso}-${f.opp}`} className={`gl-l-${f.level}${versus ? ' vs' : ''}`}>
              <span className="gl-ha">{f.home ? 'H' : 'A'}</span>
              <Logo src={opp?.logo ?? ''} size={20} />
              <b>{opp?.abbr ?? '?'}</b>
              {versus && <span className="gl-sword" title="Laga 6 poin antar-rival">⚔</span>}
              <time dateTime={f.iso}>{fmtDate(f.iso)}</time>
            </li>
          );
        })}
        {next.length === 0 && <li className="gl-none">Tidak ada sisa laga.</li>}
      </ul>
    </article>
  );
}
const byIdCount = (m: Map<string, GelarTeam>) => m.size;

export default function PerebutanGelar() {
  const res = useFetch<GelarResponse>('/api/gelar?league=ita.1');
  const teams = res.data?.teams ?? [];
  const juve = teams.find(isJuve);
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const rivals = useMemo(() => teams.filter((t) => !isJuve(t)).slice(0, CHIP_COUNT), [teams]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const selected = (picked ?? rivals.slice(0, MAX_RIVALS).map((t) => t.id)).filter((id) => byId.has(id));
  const full = selected.length >= MAX_RIVALS;
  const toggle = (id: string) => setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : full ? selected : [...selected, id]);

  const [sc, setSc] = useState<{ w: number; d: number } | null>(null);
  const [pace, setPace] = useState(false);

  if (res.loading) return <div className="kp-card kp-empty">Memuat jadwal dan proyeksi…</div>;
  if (res.error || !juve) return <div className="kp-card kp-empty">Jadwal sisa musim belum bisa dimuat dari ESPN. Coba muat ulang beberapa saat lagi.</div>;

  const N = juve.remaining;
  const wins = Math.min(N, sc?.w ?? Math.round(juve.expW));
  const draws = Math.min(N - wins, sc?.d ?? Math.round(juve.expD));
  const result = scenario(teams, juve.id, wins, draws, pace);
  const cards = [juve, ...selected.map((id) => byId.get(id)!).filter(Boolean)];
  const compare = new Set(cards.map((t) => t.id));

  // laga antar klub yang dibandingkan (tiap pertandingan sekali, dari sisi tuan rumah)
  const decisive = cards
    .flatMap((t) => t.fixtures.filter((f) => f.home && compare.has(f.opp)).map((f) => ({ iso: f.iso, home: t, away: byId.get(f.opp)! })))
    .filter((x) => x.away)
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const table = result.rows.slice(0, 6);
  if (!table.some((r) => r.isJuve)) table.push(result.rows.find((r) => r.isJuve)!);

  return (
    <section className="kp-card gl">
      <header className="kp-card-head">
        <h2 className="kp-title">Perebutan gelar</h2>
        <small className="kp-muted">Sisa jadwal Juventus vs rival, laga 6 poin, dan skenario poin akhir</small>
      </header>

      <div className="gl-chips">
        <span>Bandingkan dengan:</span>
        {rivals.map((t) => {
          const on = selected.includes(t.id);
          const locked = !on && full;
          return (
            <button key={t.id} type="button" className={`gl-chip${on ? ' on' : ''}`} onClick={() => toggle(t.id)} disabled={locked} aria-pressed={on} title={locked ? `Maksimal ${MAX_RIVALS} klub; lepas salah satu dulu` : t.name}>
              <Logo src={t.logo} size={18} /> {t.abbr}
            </button>
          );
        })}
        <small className="gl-max">{selected.length}/{MAX_RIVALS} dipilih</small>
      </div>

      <div className="gl-cards" style={{ ['--cols' as string]: cards.length }}>
        {cards.map((t, i) => (
          <TeamCard key={t.id} t={t} byId={byId} compare={compare} hero={i === 0} />
        ))}
      </div>

      <div className="gl-legend">
        {(['mudah', 'sedang', 'berat'] as const).map((l) => (
          <span key={l}><i className={`gl-d-${l}`} /> {LEVEL_TEXT[l]}</span>
        ))}
        <span>⚔ laga 6 poin antar-rival · H kandang · A tandang · 8 laga berikutnya</span>
      </div>

      <h3 className="gl-h">Laga penentu berikutnya (antar-tim di atas)</h3>
      {decisive.length ? (
        <ul className="gl-dec">
          {decisive.map((m) => (
            <li key={`${m.iso}-${m.home.id}`}>
              <Logo src={m.home.logo} size={20} /> <b>{m.home.name}</b> <span>vs</span> <b>{m.away.name}</b> <Logo src={m.away.logo} size={20} />
              <time dateTime={m.iso}>{fmtDate(m.iso)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="gl-empty">{cards.length < 2 ? 'Pilih satu klub atau lebih untuk melihat pertemuan langsungnya.' : 'Tidak ada pertemuan langsung tersisa di antara klub yang dibandingkan.'}</p>
      )}

      <h3 className="gl-h">Skenario Juventus ({N} laga tersisa)</h3>
      <div className="gl-scn">
        <label>
          <span>Menang</span>
          <b>{wins}</b>
          <input type="range" min={0} max={N} value={wins} onChange={(e) => setSc({ w: Number(e.target.value), d: Math.min(draws, N - Number(e.target.value)) })} aria-label="Jumlah kemenangan" />
        </label>
        <label>
          <span>Seri</span>
          <b>{draws}</b>
          <input type="range" min={0} max={N - wins} value={draws} onChange={(e) => setSc({ w: wins, d: Number(e.target.value) })} aria-label="Jumlah seri" />
        </label>
        <div className="gl-presets">
          <button type="button" className={!pace ? 'on' : ''} onClick={() => setPace(false)}>Rival sesuai proyeksi model</button>
          <button type="button" className={pace ? 'on' : ''} onClick={() => setPace(true)}>Rival jaga laju poin sekarang</button>
        </div>
      </div>

      <div className="gl-result">
        <b className="gl-big">{result.final} poin</b>
        <p>
          {wins}M {draws}S {result.losses}K → perkiraan finis <b>#{result.rank}</b>
          {result.leader && result.gap !== 0 ? (
            <> · {result.gap > 0 ? 'unggul' : 'tertinggal'} {Math.abs(result.gap)} poin dari {result.leader.name} ({result.leader.final})</>
          ) : result.leader ? (
            <> · sama poin dengan {result.leader.name} ({result.leader.final})</>
          ) : null}
        </p>
        <small>
          {result.need <= 0
            ? `Juventus sudah di atas semua rival (${pace ? 'laju poin sekarang' : 'proyeksi model'}).`
            : result.reachable
              ? `Supaya di atas semua rival (${pace ? 'laju poin sekarang' : 'proyeksi model'}), Juventus butuh minimal ${result.need} poin lagi — setara ${result.needWins} kemenangan dari ${N} laga.`
              : `Untuk di atas semua rival (${pace ? 'laju poin sekarang' : 'proyeksi model'}) Juventus butuh ${result.need} poin lagi, melebihi ${N * 3} poin yang tersedia.`}
        </small>
      </div>

      <div className="gl-tablewrap">
        <table className="gl-table">
          <thead>
            <tr><th>#</th><th className="l">KLUB</th><th>SEKARANG</th><th>AKHIR</th></tr>
          </thead>
          <tbody>
            {table.map((r) => {
              const pos = result.rows.indexOf(r) + 1;
              return (
                <tr key={r.id} className={r.isJuve ? 'me' : ''}>
                  <td>{pos}</td>
                  <td className="l"><Logo src={r.logo} size={20} /> <span>{r.name}</span></td>
                  <td>{r.now}</td>
                  <td><b>{r.final}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {res.data?.warnings.map((w) => (
        <p key={w} className="gl-warn">{w}</p>
      ))}
      <p className="gl-foot">
        Tingkat kesulitan sebuah laga = ekspektasi poin tim rata-rata liga di laga itu (lawan dan kandang/tandang diperhitungkan, kekuatan klub sendiri tidak), dari model Poisson yang sama dengan tab Peluang juara
        (kekuatan serang/bertahan dari gol musim ini, plus keuntungan kandang). Warna: sepertiga laga tersulit = berat, sepertiga teratas = mudah. Peringkat “terberat” = rata-rata seluruh sisa laga. Dalam skenario,
        peringkat dihitung dari poin saja (selisih gol belum dihitung) dan sama poin dianggap di atas. Jadwal mengikuti ESPN dan bisa berubah karena laga Eropa atau piala.
      </p>
    </section>
  );
}
