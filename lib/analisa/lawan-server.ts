// Analisa lawan berikutnya: laga Juventus berikutnya, prediksi Poisson, perbandingan musim ini, hasil terakhir lawan, dan cuaca (Open-Meteo).
import { JUVE_ID, isCompleted, toNum } from '../espn';
import { loadJuve } from '../juve';
import { getJsonOrNull } from './http';
import { lastFive, playability, predict, splits, weatherInfo, type Prediction, type Rec, type TeamMatch } from './lawan';
import { teamStrengths } from '../peluang';
import { loadSeason } from '../peluang-server';

export interface LawanWeather {
  city: string;
  country: string;
  temp: number;
  feels: number;
  rain: number;
  wind: number;
  label: string;
  icon: string;
  note: string;
}

export interface CompareTeam {
  position: number;
  points: number;
  played: number;
  rec: Rec;
  home: Rec;
  away: Rec;
  form: ('M' | 'S' | 'K')[];
}

export interface LawanResponse {
  match: {
    id: string;
    league: string;
    competition: string;
    iso: string;
    isHome: boolean;
    venue: string;
    juve: { name: string; logo: string };
    opp: { id: string; name: string; logo: string };
  } | null;
  prediction: Prediction | null;
  basis: string;
  compare: { juve: CompareTeam; opp: CompareTeam; league: string } | null;
  oppRecent: { iso: string; home: boolean; opp: string; score: string }[];
  weather: LawanWeather | null;
  weatherNote: string;
  warnings: string[];
  updatedAt: string;
}

function parseMatches(events: any[], teamId: string): TeamMatch[] {
  const out: TeamMatch[] = [];
  for (const e of events.filter(isCompleted)) {
    const comps: any[] = e?.competitions?.[0]?.competitors ?? [];
    const me = comps.find((c) => String(c?.team?.id) === teamId);
    const other = comps.find((c) => String(c?.team?.id) !== teamId);
    if (!me || !other || !e.date) continue;
    out.push({ iso: String(e.date), home: me.homeAway === 'home', oppId: String(other.team?.id), oppName: String(other.team?.shortDisplayName ?? other.team?.displayName ?? ''), gf: toNum(me.score), ga: toNum(other.score) });
  }
  return out.sort((a, b) => a.iso.localeCompare(b.iso));
}

async function weatherAt(city: string, country: string, iso: string): Promise<{ w: LawanWeather | null; note: string }> {
  const kick = new Date(iso);
  const days = (kick.getTime() - Date.now()) / 86_400_000;
  if (days > 15) return { w: null, note: 'Prakiraan cuaca baru tersedia sekitar 16 hari sebelum laga.' };
  if (days < -0.25) return { w: null, note: 'Laga sudah dimulai.' };
  if (!city) return { w: null, note: 'Kota stadion tidak diketahui dari sumber data, jadi cuaca tidak bisa dicari.' };

  const geo = await getJsonOrNull(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`, { revalidate: 7 * 86_400 });
  const results: any[] = geo?.results ?? [];
  const place = results.find((r) => country && String(r.country ?? '').toLowerCase().includes(country.toLowerCase().slice(0, 5))) ?? results[0];
  if (!place) return { w: null, note: `Lokasi "${city}" tidak ditemukan di Open-Meteo.` };

  const fc = await getJsonOrNull(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&hourly=temperature_2m,apparent_temperature,precipitation_probability,weathercode,windspeed_10m&windspeed_unit=kmh&timezone=UTC&forecast_days=16`,
    { revalidate: 1800 }
  );
  const times: string[] = fc?.hourly?.time ?? [];
  const hourKey = new Date(Math.round(kick.getTime() / 3_600_000) * 3_600_000).toISOString().slice(0, 13) + ':00';
  const i = times.indexOf(hourKey);
  if (i < 0) return { w: null, note: 'Prakiraan cuaca untuk jam kick-off belum tersedia.' };
  const h = fc.hourly;
  const temp = Math.round(h.temperature_2m[i]);
  const rain = Math.round(h.precipitation_probability?.[i] ?? 0);
  const wind = Math.round(h.windspeed_10m[i]);
  const code = Number(h.weathercode[i]);
  const info = weatherInfo(code);
  return { w: { city: String(place.name), country: String(place.country ?? ''), temp, feels: Math.round(h.apparent_temperature[i]), rain, wind, label: info.label, icon: info.icon, note: playability({ temp, rain, wind, code }) }, note: '' };
}

export async function fetchLawan(): Promise<LawanResponse | null> {
  const [juve, season] = await Promise.all([loadJuve().catch(() => null), loadSeason('ita.1').catch(() => null)]);
  if (!juve) return null;
  const warnings: string[] = [];
  const next = juve.upcoming[0];
  const base = { prediction: null, basis: '', compare: null, oppRecent: [], weather: null, weatherNote: '', warnings, updatedAt: new Date().toISOString() };
  if (!next) return { ...base, match: null };

  const raw = juve.juveEvents.find((e: any) => String(e.id) === String(next.id));
  const comp = raw?.competitions?.[0];
  const compJ = comp?.competitors?.find((c: any) => String(c?.team?.id) === JUVE_ID);
  const compO = comp?.competitors?.find((c: any) => String(c?.team?.id) !== JUVE_ID);
  const oppId = String(compO?.team?.id ?? next.opponentId ?? '');
  const match = {
    id: String(next.id),
    league: next.league,
    competition: next.competition,
    iso: next.iso,
    isHome: next.isHome,
    venue: String(comp?.venue?.fullName ?? next.venue ?? ''),
    juve: { name: 'Juventus', logo: String(compJ?.team?.logos?.[0]?.href ?? compJ?.team?.logo ?? '') },
    opp: { id: oppId, name: next.opponent, logo: String(compO?.team?.logos?.[0]?.href ?? compO?.team?.logo ?? next.opponentLogo ?? '') },
  };

  /* prediksi: kekuatan musim ini di Serie A; lawan di luar Serie A dianggap rata-rata liga */
  let prediction: Prediction | null = null;
  let basis = 'rata-rata liga';
  let compare: LawanResponse['compare'] = null;
  let oppRecent: LawanResponse['oppRecent'] = [];
  if (season) {
    const { rows, events, muHome, muAway } = season;
    const { att, def } = teamStrengths(rows, muHome, muAway);
    const ji = rows.findIndex((r) => r.id === JUVE_ID);
    const oi = rows.findIndex((r) => r.id === oppId);
    if (ji >= 0) {
      const aO = oi >= 0 ? att[oi] : 1;
      const dO = oi >= 0 ? def[oi] : 1;
      const lJ = (next.isHome ? muHome : muAway) * att[ji] * dO;
      const lO = (next.isHome ? muAway : muHome) * aO * def[ji];
      prediction = predict(lJ, lO);
      basis = oi >= 0 ? 'gol musim ini di Serie A' : 'gol Juventus musim ini di Serie A dan rata-rata lawan (lawan tidak ada di Serie A)';
    }
    if (ji >= 0 && oi >= 0) {
      const mJ = parseMatches(events, JUVE_ID);
      const mO = parseMatches(events, oppId);
      const mk = (i: number, ms: TeamMatch[]) => {
        const s = splits(ms);
        return { position: rows[i].position, points: rows[i].points, played: rows[i].played, rec: s.all, home: s.home, away: s.away, form: lastFive(ms) };
      };
      compare = { juve: mk(ji, mJ), opp: mk(oi, mO), league: 'Serie A' };
      oppRecent = mO.slice(-5).reverse().map((m) => ({ iso: m.iso, home: m.home, opp: m.oppName, score: `${m.gf}–${m.ga}` }));
    }
  } else warnings.push('Klasemen Serie A belum bisa dimuat dari ESPN, jadi prediksi dan perbandingan tidak tersedia.');

  const city = String(comp?.venue?.address?.city ?? (next.isHome ? 'Turin' : ''));
  const country = String(comp?.venue?.address?.country ?? (next.isHome ? 'Italy' : ''));
  const { w, note } = await weatherAt(city, country, next.iso);

  return { match, prediction, basis, compare, oppRecent, weather: w, weatherNote: note, warnings, updatedAt: new Date().toISOString() };
}
