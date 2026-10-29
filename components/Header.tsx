'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  return (
    <>
      {/* BANNER HEADER UTAMA */}
      <header className="hero-header">
        <div className="header-top-info">
          <span>MUSIM 2026/27 · SERIE A · LIGA CHAMPIONS · COPPA ITALIA</span>
          <span>Data per 28 Okt 2026 · 09:33 WIB · klasemen & jadwal otomatis (WIB)</span>
        </div>

        <div className="header-center">
          <div>
            <h1 className="brand-title">BIANCONERI <span>MATCHDAY HUB</span></h1>
            <div className="brand-badges">
              <div className="badge-item"><span className="dot-online"></span> <b>35 hari ini</b> · 4.384 total pengunjung</div>
            </div>
          </div>

          <div className="header-actions">
            <div className="support-text">Your support keeps this project alive. ↵</div>
            <div className="action-buttons">
              <button className="btn-tool">☼ Tema: terang</button>
              <button className="btn-tool">EN</button>
            </div>
          </div>
        </div>
      </header>

      {/* STICKY NAVIGASI UTAMA */}
      <div className="site-header">
        <div className="nav-wrap">
          <nav>
            <Link href="/" className={pathname === '/' ? 'active' : ''}>Beranda</Link>
            <Link href="/kompetisi" className={pathname === '/kompetisi' ? 'active' : ''}>Kompetisi</Link>
            <Link href="/skuad" className={pathname === '/skuad' ? 'active' : ''}>Skuad</Link>
            <Link href="/statistik" className={pathname === '/statistik' ? 'active' : ''}>Statistik</Link>
            <Link href="/#berita">Berita</Link>
            <Link href="/#sejarah">Klub</Link>
          </nav>
          <div className="header-right">
            <span className="live-dot" id="headerLiveDot"></span>
            <span id="headerStatusText">JUVENTUS · 2026/27</span>
          </div>
        </div>
      </div>
    </>
  );
}
