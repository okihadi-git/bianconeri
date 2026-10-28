import type { Metadata } from 'next';
import './globals.css';
import Header from '../components/Header';
import { Barlow_Condensed, Source_Sans_3 } from 'next/font/google';

const kpDisplay = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-kp-display',
  display: 'swap',
});
const kpBody = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-kp-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BIANCONERI — Juventus Club Hub',
  description: 'Matchday Hub & Rekam Jejak Juventus FC',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <Header />
        <main className="wrap">
          {children}
        </main>
      </body>
    </html>
  );
}
