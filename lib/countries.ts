// Nama negara (Inggris, seperti di Transfermarkt/FotMob) → kode bendera, kode singkat 3 huruf, nama Indonesia.
// Negara yang tidak ada di daftar tetap tampil dengan nama aslinya, tanpa bendera.
import { normName } from './names';

interface Country {
  /** kode bendera flagcdn.com, mis. "fr", "gb-eng" */
  flag: string;
  /** singkatan 3 huruf ala FIFA */
  code: string;
  id: string;
}

const C: Record<string, Country> = {
  'argentina': { flag: 'ar', code: 'ARG', id: 'Argentina' },
  'australia': { flag: 'au', code: 'AUS', id: 'Australia' },
  'austria': { flag: 'at', code: 'AUT', id: 'Austria' },
  'belgium': { flag: 'be', code: 'BEL', id: 'Belgia' },
  'bosnia-herzegovina': { flag: 'ba', code: 'BIH', id: 'Bosnia-Herzegovina' },
  'bosnia and herzegovina': { flag: 'ba', code: 'BIH', id: 'Bosnia-Herzegovina' },
  'brazil': { flag: 'br', code: 'BRA', id: 'Brasil' },
  'bulgaria': { flag: 'bg', code: 'BUL', id: 'Bulgaria' },
  'cameroon': { flag: 'cm', code: 'CMR', id: 'Kamerun' },
  'canada': { flag: 'ca', code: 'CAN', id: 'Kanada' },
  'chile': { flag: 'cl', code: 'CHI', id: 'Chili' },
  'colombia': { flag: 'co', code: 'COL', id: 'Kolombia' },
  "cote d'ivoire": { flag: 'ci', code: 'CIV', id: 'Pantai Gading' },
  'ivory coast': { flag: 'ci', code: 'CIV', id: 'Pantai Gading' },
  'croatia': { flag: 'hr', code: 'CRO', id: 'Kroasia' },
  'czech republic': { flag: 'cz', code: 'CZE', id: 'Ceko' },
  'czechia': { flag: 'cz', code: 'CZE', id: 'Ceko' },
  'denmark': { flag: 'dk', code: 'DEN', id: 'Denmark' },
  'ecuador': { flag: 'ec', code: 'ECU', id: 'Ekuador' },
  'egypt': { flag: 'eg', code: 'EGY', id: 'Mesir' },
  'england': { flag: 'gb-eng', code: 'ENG', id: 'Inggris' },
  'finland': { flag: 'fi', code: 'FIN', id: 'Finlandia' },
  'france': { flag: 'fr', code: 'FRA', id: 'Prancis' },
  'georgia': { flag: 'ge', code: 'GEO', id: 'Georgia' },
  'germany': { flag: 'de', code: 'GER', id: 'Jerman' },
  'ghana': { flag: 'gh', code: 'GHA', id: 'Ghana' },
  'greece': { flag: 'gr', code: 'GRE', id: 'Yunani' },
  'hungary': { flag: 'hu', code: 'HUN', id: 'Hungaria' },
  'iceland': { flag: 'is', code: 'ISL', id: 'Islandia' },
  'indonesia': { flag: 'id', code: 'IDN', id: 'Indonesia' },
  'iran': { flag: 'ir', code: 'IRN', id: 'Iran' },
  'ireland': { flag: 'ie', code: 'IRL', id: 'Irlandia' },
  'republic of ireland': { flag: 'ie', code: 'IRL', id: 'Irlandia' },
  'israel': { flag: 'il', code: 'ISR', id: 'Israel' },
  'italy': { flag: 'it', code: 'ITA', id: 'Italia' },
  'jamaica': { flag: 'jm', code: 'JAM', id: 'Jamaika' },
  'japan': { flag: 'jp', code: 'JPN', id: 'Jepang' },
  'kosovo': { flag: 'xk', code: 'KOS', id: 'Kosovo' },
  'mali': { flag: 'ml', code: 'MLI', id: 'Mali' },
  'mexico': { flag: 'mx', code: 'MEX', id: 'Meksiko' },
  'montenegro': { flag: 'me', code: 'MNE', id: 'Montenegro' },
  'morocco': { flag: 'ma', code: 'MAR', id: 'Maroko' },
  'netherlands': { flag: 'nl', code: 'NED', id: 'Belanda' },
  'nigeria': { flag: 'ng', code: 'NGA', id: 'Nigeria' },
  'north macedonia': { flag: 'mk', code: 'MKD', id: 'Makedonia Utara' },
  'northern ireland': { flag: 'gb-nir', code: 'NIR', id: 'Irlandia Utara' },
  'norway': { flag: 'no', code: 'NOR', id: 'Norwegia' },
  'paraguay': { flag: 'py', code: 'PAR', id: 'Paraguay' },
  'peru': { flag: 'pe', code: 'PER', id: 'Peru' },
  'poland': { flag: 'pl', code: 'POL', id: 'Polandia' },
  'portugal': { flag: 'pt', code: 'POR', id: 'Portugal' },
  'romania': { flag: 'ro', code: 'ROU', id: 'Rumania' },
  'scotland': { flag: 'gb-sct', code: 'SCO', id: 'Skotlandia' },
  'senegal': { flag: 'sn', code: 'SEN', id: 'Senegal' },
  'serbia': { flag: 'rs', code: 'SRB', id: 'Serbia' },
  'slovakia': { flag: 'sk', code: 'SVK', id: 'Slovakia' },
  'slovenia': { flag: 'si', code: 'SVN', id: 'Slovenia' },
  'south africa': { flag: 'za', code: 'RSA', id: 'Afrika Selatan' },
  'south korea': { flag: 'kr', code: 'KOR', id: 'Korea Selatan' },
  'spain': { flag: 'es', code: 'ESP', id: 'Spanyol' },
  'sweden': { flag: 'se', code: 'SWE', id: 'Swedia' },
  'switzerland': { flag: 'ch', code: 'SUI', id: 'Swiss' },
  'tunisia': { flag: 'tn', code: 'TUN', id: 'Tunisia' },
  'turkey': { flag: 'tr', code: 'TUR', id: 'Turki' },
  'türkiye': { flag: 'tr', code: 'TUR', id: 'Turki' },
  'ukraine': { flag: 'ua', code: 'UKR', id: 'Ukraina' },
  'united states': { flag: 'us', code: 'USA', id: 'Amerika Serikat' },
  'usa': { flag: 'us', code: 'USA', id: 'Amerika Serikat' },
  'uruguay': { flag: 'uy', code: 'URU', id: 'Uruguay' },
  'venezuela': { flag: 've', code: 'VEN', id: 'Venezuela' },
  'wales': { flag: 'gb-wls', code: 'WAL', id: 'Wales' },
};

const key = (name: string) => normName(name).join(' ');
const INDEX = new Map(Object.entries(C).map(([k, v]) => [key(k), v]));

export const countryInfo = (name: string | null | undefined): Country | null => (name ? INDEX.get(key(name)) ?? null : null);

/** Nama Indonesia bila dikenal, kalau tidak nama aslinya. */
export const countryId = (name: string | null | undefined) => (name ? countryInfo(name)?.id ?? name : '');

export const flagUrl = (name: string | null | undefined) => {
  const c = countryInfo(name);
  return c ? `https://flagcdn.com/w40/${c.flag}.png` : '';
};

/** Kode di header popup: ISO 2 huruf ("FR"); negara Britania (Inggris, Skotlandia, ...) memakai kode 3 huruf ("ENG"). */
export const shortCode = (name: string | null | undefined) => {
  const c = countryInfo(name);
  return !c ? '' : c.flag.includes('-') ? c.code : c.flag.toUpperCase();
};
