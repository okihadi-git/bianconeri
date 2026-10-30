import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Helper normalisasi nama untuk matching foto FotMob
const normalizeName = (name: string) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

// Helper menentukan season secara dinamis berdasarkan tahun berjalan
const getDynamicSeasonSlug = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // January = 1
  
  // Musim sepak bola Eropa biasanya berganti sekitar bulan Juli/Agustus
  const startYear = month >= 7 ? year : year - 1;
  const endYear = (startYear + 1).toString().slice(-2);
  
  return `${startYear}–${endYear}_Juventus_F.C._season`;
};

export async function GET() {
  try {
    const seasonSlug = getDynamicSeasonSlug();
    
    // 1. Fetch HTML dari Wikipedia REST API
    const wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(seasonSlug)}`, {
      next: { revalidate: 86400 } // Cache data selama 24 jam (otomatis re-fetch harian)
    });

    if (!wikiRes.ok) {
      throw new Error(`Gagal mengambil data Wikipedia: ${wikiRes.statusText}`);
    }

    const html = await wikiRes.text();
    const $ = cheerio.load(html);

    // 2. Parse Tabel Skuad Utama Wikipedia
    const wikiPlayers: Array<{ number: number; name: string; position: string }> = [];

    $('table.wikitable').first().find('tr').each((_, el) => {
      const cols = $(el).find('td, th');
      if (cols.length >= 3) {
        const numText = $(cols[0]).text().trim();
        const posText = $(cols[1]).text().trim();
        const nameText = $(cols[2]).text().trim().replace(/\[.*?\]/g, ''); // bersihkan sitasi [1], [2]

        const num = parseInt(numText, 10);
        if (!isNaN(num) && nameText) {
          wikiPlayers.push({
            number: num,
            name: nameText,
            position: posText,
          });
        }
      }
    });

    // 3. Fetch Data FotMob (Team ID Juventus: 9885) untuk foto avatar & metadata
    let fotmobMap = new Map<string, any>();
    try {
      const fotmobRes = await fetch('https://www.fotmob.com/api/teams?id=9885', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        next: { revalidate: 86400 }
      });
      
      if (fotmobRes.ok) {
        const fotmobData = await fotmobRes.json();
        const squadGroups = fotmobData.squad || [];
        
        squadGroups.forEach((group: any) => {
          const members = group.members || group.data || [];
          members.forEach((player: any) => {
            fotmobMap.set(normalizeName(player.name), player);
          });
        });
      }
    } catch (e) {
      console.warn('FotMob fetch warning:', e);
    }

    // 4. Combine Wikipedia Data + FotMob Photos
    const finalSquad = wikiPlayers.map((player) => {
      const cleanName = normalizeName(player.name);
      const match = fotmobMap.get(cleanName);

      // Map Kategori Posisi Sederhana
      let posCategory: 'Kiper' | 'Bek' | 'Gelandang' | 'Penyerang' = 'Gelandang';
      const posUpper = player.position.toUpperCase();
      if (posUpper.includes('GK')) posCategory = 'Kiper';
      else if (posUpper.includes('DF') || posUpper.includes('CB') || posUpper.includes('LB') || posUpper.includes('RB')) posCategory = 'Bek';
      else if (posUpper.includes('MF')) posCategory = 'Gelandang';
      else if (posUpper.includes('FW') || posUpper.includes('ST') || posUpper.includes('RW') || posUpper.includes('LW')) posCategory = 'Penyerang';

      return {
        id: `player-${player.number}`,
        number: player.number,
        name: player.name,
        photoUrl: match
          ? `https://images.fotmob.com/image_resources/playerimages/${match.id}.png`
          : 'https://www.fotmob.com/images/player_fallback.png',
        countryFlag: match?.cCode ? '' : '🏳️',
        countryCode: match?.cCode || 'N/A',
        positionCategory: posCategory,
        positionDetail: player.position || posCategory,
        age: match?.age || 25,
        salaryWeeklyNum: 50, // Fallback default
        salaryDisplay: '€50 rb/pekan',
        marketValueNum: 20.0, // Fallback default
        marketValueDisplay: '€20 jt',
        status: null,
      };
    });

    return NextResponse.json({
      success: true,
      season: seasonSlug,
      total: finalSquad.length,
      data: finalSquad
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses skuad' },
      { status: 500 }
    );
  }
}
