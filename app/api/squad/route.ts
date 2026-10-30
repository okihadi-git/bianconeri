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

// Helper menentukan season secara dinamis (Menggunakan Hyphen '-' biasa)
const getDynamicSeasonSlug = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // January = 1
  
  // Musim sepak bola Eropa berganti sekitar bulan Juli/Agustus
  const startYear = month >= 7 ? year : year - 1;
  const endYear = (startYear + 1).toString().slice(-2);
  
  // Menggunakan strip biasa (-) bukan en-dash (–) agar URL Wikipedia valid
  return `${startYear}-${endYear}_Juventus_F.C._season`;
};

export async function GET() {
  try {
    const seasonSlug = getDynamicSeasonSlug();
    
    // 1. Fetch HTML dari Wikipedia REST API (Ditambahkan Header User-Agent & Fallback)
    let wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(seasonSlug)}`, {
      headers: {
        'User-Agent': 'MyBianconeriApp/1.0 (https://bianconeri.vercel.app)',
      },
      next: { revalidate: 86400 } // Cache 24 jam
    });

    // Fallback jika halaman musim spesifik belum ada/404, ambil dari halaman utama Juventus F.C.
    if (!wikiRes.ok) {
      wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/Juventus_F.C.`, {
        headers: {
          'User-Agent': 'MyBianconeriApp/1.0 (https://bianconeri.vercel.app)',
        },
        next: { revalidate: 86400 }
      });
    }

    if (!wikiRes.ok) {
      throw new Error(`Gagal mengambil data Wikipedia (${wikiRes.status}: ${wikiRes.statusText})`);
    }

    const html = await wikiRes.text();
    const $ = cheerio.load(html);

    // 2. Parse Tabel Skuad Utama Wikipedia
    const wikiPlayers: Array<{ number: number; name: string; position: string }> = [];

    // Mencari tabel wikitable yang berisi skuad pemain
    $('table.wikitable, table.vcard').find('tr').each((_, el) => {
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
      console
