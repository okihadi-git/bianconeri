import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY || '7a3c9383187f412589f1a57a27a3e04f';

  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/SA/standings', {
      headers: {
        'X-Auth-Token': apiKey,
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Gagal mengambil data dari Football-Data API' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
