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
