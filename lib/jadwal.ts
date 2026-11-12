// "Analisa → Kesulitan jadwal": perkiraan poin (xPts) tiap laga liga ke depan, dengan model Poisson yang sama dengan
// "Lawan berikutnya" dan "Peluang juara". Fungsi murni (tanpa fetch), mudah diuji.
import { isCompleted } from './espn';
import { outcomeProbs, teamStrengths } from './peluang';
import type { SeasonRow } from './peluang-server';

export { EASY_AT, HARD_BELOW, LEVEL_LABEL, defaultRival, levelOf, type Level } from './jadwal-ui';
import { levelOf, type Level } from './jadwal-ui';

export const HORIZON = 6;

export interface JFixture {
  id: string;
  iso: string;
  home: boolean;
  oppId: string;
  oppName: string;
  oppLogo: string;
  /** peringkat lawan saat ini; null bila lawan tak ada di klasemen */
  oppPos: number | null;
  /** peluang menang tim ini (0–1) */
  win: number;
  draw: number;
  xpts: number;
  level: Level;
}

export interface JTeam {
  id: string;
  name: string;
  logo: string;
  position: number;
  fixtures: JFixture[];
  /** jumlah xPts semua `fixtures` */
  xpts: number;
  /** poin maksimum (3 × jumlah laga) */
  max: number;
}

/** xPts = 3 × peluang menang + peluang seri. */
export const xptsOf = (win: number, draw: number) => 3 * win + draw;

const teamName = (c: any) => String(c?.team?.shortDisplayName ?? c?.team?.displayName ?? c?.team?.name ?? '');

/** Laga liga yang belum selesai milik `teamId`, urut tanggal; yang tanggalnya sudah lewat lebih dari 4 jam (ditunda) diabaikan. */
export function upcomingEvents(events: any[], teamId: string, now: Date): any[] {
  const cutoff = now.getTime() - 4 * 3_600_000;
  return events
    .filter((e) => !isCompleted(e) && e?.date && new Date(e.date).getTime() >= cutoff)
    .filter((e) => (e?.competitions?.[0]?.competitors ?? []).some((c: any) => String(c?.team?.id) === teamId))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function buildTeams(rows: SeasonRow[], events: any[], muHome: number, muAway: number, now: Date, horizon = HORIZON): JTeam[] {
  const { att, def } = teamStrengths(rows, muHome, muAway);
  const idx = new Map(rows.map((r, i) => [r.id, i]));
  return rows
    .map((row, ti): JTeam => {
      const fixtures: JFixture[] = [];
      for (const e of upcomingEvents(events, row.id, now).slice(0, horizon)) {
        const comps: any[] = e.competitions[0].competitors;
        const me = comps.find((c) => String(c?.team?.id) === row.id);
        const op = comps.find((c) => String(c?.team?.id) !== row.id);
        if (!me || !op) continue;
        const oppId = String(op.team?.id ?? '');
        const oi = idx.get(oppId);
        const home = me.homeAway === 'home';
        // lawan di luar klasemen dianggap rata-rata liga (kekuatan 1)
        const aO = oi != null ? att[oi] : 1;
        const dO = oi != null ? def[oi] : 1;
        const lMe = (home ? muHome : muAway) * att[ti] * dO;
        const lOp = (home ? muAway : muHome) * aO * def[ti];
        // outcomeProbs() = sudut pandang tuan rumah
        const p = home ? outcomeProbs(lMe, lOp) : outcomeProbs(lOp, lMe);
        const win = home ? p.win : p.loss;
        const xpts = xptsOf(win, p.draw);
        fixtures.push({
          id: String(e.id),
          iso: new Date(e.date).toISOString(),
          home,
          oppId,
          oppName: teamName(op) || (oi != null ? rows[oi].name : 'TBA'),
          oppLogo: oi != null ? rows[oi].logo : String(op.team?.logos?.[0]?.href ?? ''),
          oppPos: oi != null ? rows[oi].position : null,
          win,
          draw: p.draw,
          xpts,
          level: levelOf(xpts),
        });
      }
      return { id: row.id, name: row.name, logo: row.logo, position: row.position, fixtures, xpts: fixtures.reduce((n, f) => n + f.xpts, 0), max: 3 * fixtures.length };
    })
    .sort((a, b) => a.position - b.position);
}
