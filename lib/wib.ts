// Format tanggal/jam WIB untuk halaman Women dan Akademi.
const WIB = 'Asia/Jakarta';

/** "Jum, 13 Nov" */
export function dayLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: WIB }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('weekday')}, ${get('day')} ${get('month')}`;
}

/** "00:45 WIB" */
export const timeLabel = (iso: string): string => `${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: WIB }).format(new Date(iso))} WIB`;

/** "8 Nov" */
export const shortDate = (iso: string): string => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: WIB }).format(new Date(iso));
