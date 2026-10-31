export type Letter = 'W' | 'D' | 'L';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  position: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: Letter[];
}

export interface MatchEvent {
  kind: 'goal' | 'red';
  side: 'juve' | 'opp';
  name: string;
  minute: string;
  tag: string;
}

/** Pertandingan Juventus (semua kompetisi). */
export interface Match {
  id: string;
  league: string;
  competition: string;
  week: number | null;
  iso: string;
  dateLabel: string;
  dayTime: string;
  opponentId: string;
  opponent: string;
  opponentAbbr: string;
  opponentLogo: string;
  isHome: boolean;
  venueText: string;
  venue: string;
  juveScore: number;
  opponentScore: number;
  result: Letter | null;
  events: MatchEvent[];
  records: { juve?: string; opp?: string } | null;
  /** Babak/ronde dari ESPN, mis. "League Phase - Matchday 4" atau "Round of 16". Bisa kosong. */
  round: string;
  status: 'pre' | 'live' | 'post';
  /** true = Juventus menang (termasuk adu penalti), false = kalah, null = belum selesai/tidak ada data. */
  winner: boolean | null;
  /** Skor adu penalti kalau ada. */
  shootout: { juve: number; opp: number } | null;
}

export interface SimpleSide {
  id: string;
  name: string;
  abbr: string;
  logo: string;
  score: number | null;
}

/** Pertandingan siapa pun dalam satu kompetisi. */
export interface SimpleMatch {
  id: string;
  iso: string;
  month: string;
  dateLabel: string;
  dayTime: string;
  round: string;
  status: 'pre' | 'live' | 'post';
  home: SimpleSide;
  away: SimpleSide;
  involvesJuve: boolean;
}

export interface PlayerStat {
  id: string;
  name: string;
  teamId: string;
  team: string;
  goals: number;
  pens: number;
  yellow: number;
  red: number;
}

export interface Detail {
  loading: boolean;
  error?: boolean;
  stats?: { key: string; label: string; juve: string; opp: string }[];
  venue?: string;
  attendance?: number | null;
  referee?: string;
}

export interface Athlete {
  id: string;
  name: string;
  jersey: string;
  position: string;
  group: 'Kiper' | 'Bek' | 'Gelandang' | 'Penyerang' | 'Lainnya';
  age: number | null;
  nation: string;
  height: string;
  photo: string;
}

/* ---------- skor live di beranda ---------- */

export interface LiveSide {
  id: string;
  name: string;
  abbr: string;
  logo: string;
  score: number;
  isJuve: boolean;
}

export interface TimelineItem {
  id: string;
  minute: string;
  sort: number;
  kind: 'goal' | 'own-goal' | 'pen-goal' | 'pen-miss' | 'yellow' | 'red' | 'sub' | 'period';
  /** sisi tampilan: tuan rumah kiri, tamu kanan. 'none' untuk penanda babak. */
  side: 'home' | 'away' | 'none';
  player: string;
  /** assist (untuk gol) atau pemain yang diganti (untuk pergantian). */
  related: string;
  label: string;
}

export interface LineupPlayer {
  id: string;
  name: string;
  jersey: string;
  position: string;
  place: number;
  /** menit masuk/keluar lapangan bila diketahui */
  subOn: string;
  subOff: string;
  goals: number;
  yellow: number;
  red: number;
}

export interface Lineup {
  teamId: string;
  name: string;
  formation: string;
  starters: LineupPlayer[];
  subs: LineupPlayer[];
}

export interface LiveStat {
  key: string;
  label: string;
  home: string;
  away: string;
}

export interface ScorerLine {
  name: string;
  minute: string;
  tag: string;
}

export interface LiveMatch {
  id: string;
  league: string;
  competition: string;
  round: string;
  state: 'live' | 'post';
  /** mis. "Selesai", "Babak 1 · 34'", "Turun minum" */
  statusText: string;
  iso: string;
  dateLabel: string;
  dayTime: string;
  venue: string;
  referee: string;
  attendance: number | null;
  home: LiveSide;
  away: LiveSide;
  shootout: { home: number; away: number } | null;
  scorers: { home: ScorerLine[]; away: ScorerLine[] };
  timeline: TimelineItem[];
  lineups: { home: Lineup | null; away: Lineup | null };
  stats: LiveStat[];
}

export interface LiveResponse {
  match: LiveMatch | null;
  updatedAt: string;
}

/* ---------- skuad ---------- */

export type SquadGroup = 'Kiper' | 'Bek' | 'Gelandang' | 'Penyerang' | 'Lainnya';

/** Satu pemain di halaman skuad. Field yang tidak diberikan sumber data bernilai null/kosong, tidak pernah diisi tebakan. */
export interface SquadPlayer {
  id: string;
  name: string;
  jersey: string;
  captain: boolean;
  /** mis. "Centre-Back" atau "LB" */
  position: string;
  group: SquadGroup;
  age: number | null;
  nation: string[];
  heightCm: number | null;
  /** tanggal berakhir kontrak (YYYY-MM-DD) */
  contractUntil: string | null;
  /** nilai pasar dalam euro */
  marketValue: number | null;
  photo: string;
}

export interface SquadResponse {
  players: SquadPlayer[];
  coach: string;
  source: 'transfermarkt' | 'fotmob';
  updatedAt: string;
}

/* ---------- Halaman Klub (Wikipedia + Wikidata) ---------- */

export interface KlubCard {
  label: string;
  value: string | null;
  sub: string | null;
}

export interface KlubEra {
  title: string;
  /** mis. "1897–1923", diambil dari judul seksi bila ada */
  span: string | null;
  paragraphs: string[];
}

export interface KlubPhoto {
  url: string;
  width: number | null;
  height: number | null;
  caption: string;
  credit: string | null;
  license: string | null;
  pageUrl: string | null;
}

export interface KlubResponse {
  club: string;
  name: string;
  cards: KlubCard[];
  eras: KlubEra[];
  photo: KlubPhoto | null;
  timeline: { year: string; text: string }[];
  /** artikel Wikipedia yang dipakai untuk narasi; null bila semuanya gagal */
  source: { lang: 'id' | 'en'; url: string; title: string } | null;
  updatedAt: string;
  /** alasan tiap sumber yang gagal, untuk pelacakan di log */
  errors: Record<string, string>;
}

/* ---------- Halaman Pelatih (Wikipedia) ---------- */

export interface CoachResponse {
  name: string;
  /** judul artikel Wikipedia yang dipakai */
  title: string;
  /** deskripsi singkat Wikipedia, mis. "Italian football manager" */
  description: string | null;
  /** paragraf pembuka artikel (dipangkas) */
  paragraphs: string[];
  photo: string | null;
  url: string;
  lang: 'id' | 'en';
  updatedAt: string;
}
