import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Centros de Acopio - Emergencia Sísmica Venezuela',
  description:
    'Aplicación de emergencia para registrar y localizar centros de acopio vecinales tras el sismo en Venezuela. Encuentra suministros cerca de ti.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Centros de Acopio VE',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#059669',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} h-full`}>
        {children}
        {/* DATATA · presencia en directo (entra / sale) */}
        <Script src="/datata-presence.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
