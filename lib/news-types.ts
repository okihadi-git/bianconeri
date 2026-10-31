export type NewsCategory = 'transfer' | 'cedera' | 'kontrak' | 'tim';
export type NewsReliability = 'resmi' | 'kuat' | 'rumor';

/** Pemain skuad (foto FotMob, atau inisial) atau klub (logo ESPN) yang disebut di judul. */
export interface NewsEntity {
  kind: 'player' | 'club';
  name: string;
  image: string | null;
  initials: string;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  iso: string;
  category: NewsCategory;
  /** Perkiraan otomatis dari sumber + kata kunci judul; null = tanpa label */
  reliability: NewsReliability | null;
  entities: NewsEntity[];
}

export interface NewsResponse {
  items: NewsItem[];
  updatedAt: string;
  /** alasan tiap umpan/sumber yang gagal, untuk pelacakan di log */
  errors: Record<string, string>;
}
