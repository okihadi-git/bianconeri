import { NextResponse } from 'next/server';

export async function GET() {
  try {
    let formattedSquad: any[] = [];

    // --- METODE 1: Fetch dari FotMob dengan Browser Headers Lengkap ---
    try {
      const fotmobRes = await fetch('https://www.fotmob.com/api/teams?id=9885', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Referer': 'https://www.fotmob.com/teams/9885/overview/juventus',
        },
        next: { revalidate: 3600 }
      });

      if (fotmobRes.ok) {
        const data = await fotmobRes.json();
        const squadGroups = data.squad || [];

        squadGroups.forEach((group: any) => {
          const groupTitle = (group.title || '').toLowerCase();
          const members = group.members || group.data || [];

          let posCategory: 'Kiper' | 'Bek' | 'Gelandang' | 'Penyerang' = 'Gelandang';
          if (groupTitle.includes('goalkeeper') || groupTitle.includes('kiper')) posCategory = 'Kiper';
          else if (groupTitle.includes('defender') || groupTitle.includes('bek')) posCategory = 'Bek';
          else if (groupTitle.includes('midfielder') || groupTitle.includes('gelandang')) posCategory = 'Gelandang';
          else if (groupTitle.includes('attacker') || groupTitle.includes('forward') || groupTitle.includes('penyerang')) posCategory = 'Penyerang';

          members.forEach((player: any) => {
            const shirtNum = parseInt(player.shirtNumber || player.number, 10) || 0;
            formattedSquad.push({
              id: `player-${player.id || shirtNum}`,
              number: shirtNum,
              name: player.name || 'Pemain Juventus',
              photoUrl: player.id 
                ? `https://images.fotmob.com/image_resources/playerimages/${player.id}.png`
                : 'https://www.fotmob.com/images/player_fallback.png',
              countryCode: player.cCode || 'ITA',
              positionCategory: posCategory,
              positionDetail: player.role?.key || posCategory,
              age: player.age || 25,
              salaryWeeklyNum: 50,
              salaryDisplay: '€50 rb/pekan',
              marketValueNum: 20.0,
              marketValueDisplay: '€20 jt',
              status: null,
            });
          });
        });
      }
    } catch (err) {
      console.warn('FotMob fetch failed, switching to backup provider...', err);
    }

    // --- METODE 2 (BACKUP): TheSportsDB API jika FotMob gagal ---
    if (formattedSquad.length === 0) {
      // ID Team Juventus di TheSportsDB: 133676
      const tsdbRes = await fetch('https://www.thesportsdb.com/api/v1/json/3/lookup_all_players.php?id=133676', {
        next: { revalidate: 3600 }
      });

      if (tsdbRes.ok) {
        const tsdbData = await tsdbRes.json();
        const players = tsdbData.player || [];

        players.forEach((player: any) => {
          const pos = (player.strPosition || '').toLowerCase();
          let posCategory: 'Kiper' | 'Bek' | 'Gelandang' | 'Penyerang' = 'Gelandang';
          
          if (pos.includes('goalkeeper')) posCategory = 'Kiper';
          else if (pos.includes('defender') || pos.includes('back')) posCategory = 'Bek';
          else if (pos.includes('midfield')) posCategory = 'Gelandang';
          else if (pos.includes('forward') || pos.includes('winger') || pos.includes('striker')) posCategory = 'Penyerang';

          const shirtNum = parseInt(player.strNumber, 10) || 0;

          formattedSquad.push({
            id: `player-${player.idPlayer}`,
            number: shirtNum,
            name: player.strPlayer,
            photoUrl: player.strCutout || player.strThumb || 'https://www.fotmob.com/images/player_fallback.png',
            countryCode: (player.strNationality || 'ITA').slice(0, 3).toUpperCase(),
            positionCategory: posCategory,
            positionDetail: player.strPosition || posCategory,
            age: 26,
            salaryWeeklyNum: 50,
            salaryDisplay: '€50 rb/pekan',
            marketValueNum: 20.0,
            marketValueDisplay: '€20 jt',
            status: null,
          });
        });
      }
    }

    // Urutkan skuad berdasarkan nomor punggung
    formattedSquad.sort((a, b) => a.number - b.number);

    return NextResponse.json({
      success: true,
      total: formattedSquad.length,
      data: formattedSquad
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses data skuad' },
      { status: 500 }
    );
  }
}
