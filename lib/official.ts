// Laga persahabatan klub (pra-musim, dsb.) bukan pertandingan resmi dan tidak dihitung di Analitik.
/** True bila matchDetails FotMob berasal dari kompetisi persahabatan ("Club Friendlies", "Friendlies", dll). */
export function isFriendly(data: any): boolean {
  const g = data?.general;
  return [g?.leagueName, g?.parentLeagueName, g?.leagueRoundName].some((v) => /friendl|persahabatan|amichevol/i.test(String(v ?? '')));
}
