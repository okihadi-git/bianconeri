// Pengambilan JSON bersama untuk sumber luar tab Analisa (Wikipedia, UEFA, Open-Meteo). Hanya dipakai di server.
const CONTACT = process.env.WIKI_CONTACT || 'https://github.com/';
export const UA = `bianconeri-matchday-hub/1.0 (fan project; ${CONTACT})`;

interface Opts {
  headers?: Record<string, string>;
  /** detik cache Next (default 1 jam) */
  revalidate?: number;
  /** milidetik (default 12 detik) */
  timeout?: number;
}

/** GET JSON; melempar error bila respons bukan 2xx. */
export async function getJson(url: string, { headers = {}, revalidate = 3600, timeout = 12_000 }: Opts = {}): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA, ...headers },
    next: { revalidate },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Sama, tetapi gagal = null (untuk sumber pelengkap seperti cuaca). */
export async function getJsonOrNull(url: string, opts: Opts = {}): Promise<any | null> {
  try {
    return await getJson(url, { timeout: 10_000, ...opts });
  } catch {
    return null;
  }
}
