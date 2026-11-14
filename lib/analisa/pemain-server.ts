// Analisa → Pemain. ESPN: lineup + kejadian gol tiap laga selesai (semua kompetisi). Wikipedia: angka dasar tonggak karier.
// Bagian Wikipedia boleh gagal tanpa merusak dua bagian lain.
import { JUVE_ID, isCompleted, seasonStart } from '../espn';
import { loadJuve } from '../juve';
import { buildLiveMatch, fetchSummary } from '../live';
import { getJson } from './http';
import { buildDuets, buildImpact, buildMilestones, parseWikiPlayers, type PMatch, type PemainResponse, type WikiPlayer } from './pemain';
import { minuteOf } from './util';

const WIKI_TITLES = ['List of Juventus FC players', 'List of Juventus F.C. players'];

async function loadMatches(): Promise<{ matches: PMatch[]; skipped: number }> {
  const { juveEvents } = await loadJuve();
  const done = juveEvents.filter(isCompleted);
  const matches: PMatch[] = [];
  let skipped = 0;
  for (let i = 0; i < done.length; i += 8) {
    const batch = done.slice(i, i + 8);
    const res = await Promise.all(batch.map((e: any) => fetchSummary(e._league, String(e.id), false).catch(() => null)));
    batch.forEach((event: any, k: number) => {
      const summary = res[k];
      if (!summary) return void (skipped += 1);
      const live = buildLiveMatch(event, summary);
      const lineup = [live.lineups.home, live.lineups.away].find((l) => l?.teamId === JUVE_ID);
      if (!lineup || !lineup.starters.length) return void (skipped += 1);
      const juveIsHome = live.home.isJuve;
      const juveSide = juveIsHome ? live.home : live.away;
      const oppSide = juveIsHome ? live.away : live.home;
      const turnedOut = lineup.subs.filter((p) => minuteOf(p.subOn) != null);
      matches.push({
        id: String(event.id),
        iso: String(live.iso || event.date || ''),
        gf: juveSide.score,
        ga: oppSide.score,
        starters: lineup.starters.map((p) => ({ id: p.id, name: p.name })),
        played: [...lineup.starters, ...turnedOut].map((p) => ({ id: p.id, name: p.name, goals: p.goals })),
        duets: live.timeline.filter((t) => t.kind === 'goal' && t.side === (juveIsHome ? 'home' : 'away') && t.player && t.related).map((t) => ({ scorer: t.player, assist: t.related })),
      });
    });
  }
  return { matches, skipped };
}

async function loadWiki(): Promise<{ rows: WikiPlayer[]; asOf: string | null; title: string; url: string }> {
  let lastError = 'artikel tidak ditemukan';
  for (const page of WIKI_TITLES) {
    try {
      const body = await getJson('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'parse', format: 'json', formatversion: '2', redirects: '1', prop: 'text', page }), { revalidate: 86400, timeout: 15_000 });
      const html = body?.parse?.text;
      if (typeof html !== 'string') throw new Error('artikel tidak ditemukan');
      const parsed = parseWikiPlayers(html);
      if (!parsed.rows.length) throw new Error('tabel pemain tidak bisa dibaca');
      const title = String(body.parse.title ?? page);
      return { ...parsed, title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` };
    } catch (e: any) {
      lastError = String(e?.message ?? e);
    }
  }
  throw new Error(lastError);
}

export async function fetchPemain(): Promise<PemainResponse> {
  const warnings: string[] = [];
  const [{ matches, skipped }, wiki] = await Promise.all([
    loadMatches(),
    loadWiki().catch((e: any) => {
      warnings.push(`Tonggak karier tidak tersedia: daftar pemain Wikipedia gagal dibaca (${String(e?.message ?? e)}).`);
      return null;
    }),
  ]);
  if (skipped) warnings.push(`Susunan pemain tidak tersedia untuk ${skipped} laga selesai di ESPN; laga itu tidak ikut hitungan.`);
  if (!matches.length) warnings.unshift('Belum ada laga Juventus dengan susunan pemain di data ESPN.');

  let milestones: PemainResponse['milestones'] = [];
  if (wiki) {
    milestones = buildMilestones(wiki.rows, wiki.asOf, matches);
    if (!wiki.asOf) warnings.push('Tanggal acuan statistik di artikel Wikipedia tidak ditemukan, jadi angka dasar tidak ditambah dari laga terbaru dan bisa tertinggal beberapa laga.');
    else if (wiki.asOf < seasonStart().toISOString().slice(0, 10)) warnings.push(`Angka dasar Wikipedia per ${wiki.asOf}, sebelum awal musim ini; laga antara tanggal itu dan awal musim tidak ikut ditambahkan.`);
  }

  return {
    matches: matches.length,
    impact: buildImpact(matches),
    duets: buildDuets(matches),
    milestones,
    wiki: wiki ? { title: wiki.title, url: wiki.url, asOf: wiki.asOf } : null,
    warnings,
    updatedAt: new Date().toISOString(),
  };
}
