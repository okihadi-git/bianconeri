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

// Helper menentukan season secara dinamis
const getDynamicSeasonSlug = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  const endYear = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYear}_Juventus_F.C._season`;
};

export async function GET() {
  try {
    const seasonSlug = getDynamicSeasonSlug();
    
    // 1. Fetch HTML dari Wikipedia REST API
    let wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(seasonSlug)}`, {
      headers: {
        'User-Agent': 'MyBianconeriApp/1.0 (https://bianconeri.vercel.app)',
      },
      next: { revalidate: 86400 }
    });

    if (!wikiRes.ok) {
      wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/Juventus_F.C.`, {
        headers: {
          'User-Agent': 'MyBianconeriApp/1.0 (https://bianconeri.vercel.app)',
        },
        next: { revalidate: 86400 }
      });
    }

    if (!wikiRes.ok) {
      throw new Error(`Gagal mengambil data Wikipedia (${wikiRes.status})`);
    }

    const html = await wikiRes.text();
    const $ = cheerio.load(html);

    // 2. Parse Tabel Skuad Wikipedia dengan Presisi Kolom
    const wikiPlayers: Array<{ number: number; name: string; position: string; countryCode: string }> = [];

    $('table.wikitable, table.vcard').find('tr').each((_, el) => {
      const cols = $(el).find('td');
      if (cols.length >= 3) {
        // Ambil No Punggung
        const numText = $(cols[0]).text().trim();
        const num = parseInt(numText, 10);

        if (!isNaN(num)) {
          let posText = '';
          let nameText = '';
          let countryCode = '';

          // Ekstraksi pintar berdasarkan struktur baris
          cols.each((i, col) => {
            const text = $(col).text().trim();
            const linkText = $(col).find('a').not('.image').first().text().trim();

            // Deteksi Posisi (GK, DF, MF, FW)
            if (['GK', 'DF', 'MF', 'FW'].includes(text.toUpperCase())) {
              posText = text;
            }

            // Deteksi Kode Negara dari flag template
            const flagAlt = $(col).find('img').attr('alt') || '';
            const flagClass = $(col).find('span.flagicon, span.mw-image-border').text().trim();
            if (flagAlt || flagClass) {
              countryCode = flagClass || flagAlt;
            }

            // Deteksi Nama Pemain (Teks di dalam link <a> yang bukan angka/posisi/negara)
            if (linkText && !nameText && linkText.length > 2 && isNaN(parseInt(linkText, 10)) && !['GK', 'DF', 'MF', 'FW'].includes(linkText.toUpperCase())) {
              nameText = linkText.replace(/\[.*?\]/g, '');
            }
          });

          // Fallback jika nameText belum ketemu dari link <a>
          if (!nameText && cols.length >= 4) {
            nameText = $(cols[3]).text().trim().replace(/\[.*?\]/g, '');
          }

          if (nameText) {
            wikiPlayers.push({
              number: num,
              name: nameText,
              position: posText || 'MF',
              countryCode: countryCode
            });
          }
        }
      }
    });

    // 3. Fetch Data FotMob (Team ID Juventus: 9885)
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
            // Simpan berdasarkan nama yang dinormalisasi & id
            fotmobMap.set(normalizeName(player.name), player);
            if (player.cCode) {
              fotmobMap.set(`num-${player.shirtNumber}`, player);
            }
          });
        });
      }
    } catch (e) {
      console.warn('FotMob fetch warning:', e);
    }

    // 4. Gabungkan Data Wikipedia + Foto FotMob
    const finalSquad = wikiPlayers.map((player) => {
      const cleanName = normalizeName(player.name);
      // Cari match berdasarkan nama atau nomor punggung
      const match = fotmobMap.get(cleanName) || fotmobMap.get(`num-${player.number}`);

      let posCategory: 'Kiper' | 'Bek' | 'Gelandang' | 'Penyerang' = 'Gelandang';
      const posUpper = player.position.toUpperCase();
      if (posUpper.includes('GK')) posCategory = 'Kiper';
      else if (posUpper.includes('DF') || posUpper.includes('CB') || posUpper.includes('LB') || posUpper.includes('RB')) posCategory = 'Bek';
      else if (posUpper.includes('MF')) posCategory = 'Gelandang';
      else if (posUpper.includes('FW') || posUpper.includes('ST') || posUpper.includes('RW') || posUpper.includes('LW')) posCategory = 'Penyerang';

      return {
        id: `player-${player.number}`,
        number: player.number,
        name: player.name, // Sekarang berisi nama asli pemain
        photoUrl: match?.id
          ? `https://images.fotmob.com/image_resources/playerimages/${match.id}.png`
          : 'https://www.fotmob.com/images/player_fallback.png',
        countryCode: match?.cCode || player.countryCode || 'ITA',
        positionCategory: posCategory,
        positionDetail: player.position || posCategory,
        age: match?.age || 25,
        salaryWeeklyNum: 50,
        salaryDisplay: '€50 rb/pekan',
        marketValueNum: 20.0,
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
