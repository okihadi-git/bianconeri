import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'BIANCONERI — Juventus Club Hub',
  description: 'Matchday Hub, Klasemen, & Rekam Jejak Juventus FC',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        {/* Header Banner & Navigasi Statis */}
        <Header />

        {/* Konten Halaman (page.tsx) akan berganti di dalam <main> ini */}
        <main className="wrap">
          {children}
        </main>
      </body>
    </html>
  );
}
