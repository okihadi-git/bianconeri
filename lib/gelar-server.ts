// Mengambil sisa jadwal dari ESPN dan menyusun data tab "Perebutan gelar" (lib/gelar.ts).
import { isCompleted } from './espn';
import { buildGelar, type GelarTeam } from './gelar';
import { fetchPeluang, loadSeason } from './peluang-server';

export interface GelarResponse {
  league: string;
  teams: GelarTeam[];
  warnings: string[];
  updatedAt: string;
}

const ALLOWED = ['ita.1'];
const cache = new Map<string, { at: number; sig: string; body: GelarResponse }>();

export async function fetchGelar(league = 'ita.1'): Promise<GelarResponse | null> {
  if (!ALLOWED.includes(league)) return null;
  const season = await loadSeason(league);
  const pel = await fetchPeluang(league); // proyeksi poin akhir dari simulasi (di-cache)
  if (!season || !pel) return null;

  const { rows, events, muHome, muAway, now } = season;
  const sig = `${league}:${rows.reduce((n, r) => n + r.played, 0)}:${events.length}`;
  const hit = cache.get(league);
  if (hit && hit.sig === sig && now.getTime() - hit.at < 15 * 60_000) return hit.body;

  const abbr = new Map<string, string>();
  const fixtures: { iso: string; homeId: string; awayId: string }[] = [];
  for (const e of events) {
    const comps: any[] = e?.competitions?.[0]?.competitors ?? [];
    for (const c of comps) if (c?.team?.id) abbr.set(String(c.team.id), String(c.team.abbreviation ?? c.team.shortDisplayName ?? '').toUpperCase());
    if (isCompleted(e)) continue;
    const h = comps.find((c) => c.homeAway === 'home');
    const a = comps.find((c) => c.homeAway === 'away');
    if (h && a && e.date) fixtures.push({ iso: String(e.date), homeId: String(h.team?.id), awayId: String(a.team?.id) });
  }

  const teams = buildGelar({
    teams: rows.map((r) => ({ id: r.id, name: r.name, abbr: abbr.get(r.id) || r.name.slice(0, 3).toUpperCase(), logo: r.logo, position: r.position, points: r.points, played: r.played, gf: r.gf, ga: r.ga, gd: r.gd })),
    fixtures,
    muHome,
    muAway,
    proj: new Map(pel.teams.map((t) => [t.id, t.proj])),
  });

  const warnings: string[] = [...pel.warnings];
  const expected = teams.reduce((n, t) => n + t.remaining, 0) / 2;
  if (fixtures.length < expected) warnings.push(`Jadwal ESPN baru memuat ${fixtures.length} dari ${expected} sisa laga, jadi daftar laga tiap klub bisa belum lengkap.`);

  const body: GelarResponse = { league, teams, warnings, updatedAt: now.toISOString() };
  cache.set(league, { at: now.getTime(), sig, body });
  return body;
}
