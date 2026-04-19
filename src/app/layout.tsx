import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';

import AmplifyConfigProvider from '@/lib/amplify/config';
import { Toaster } from '@/components/ui/sonner';

import './globals.css';

import type { Metadata } from 'next';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'NexoERP',
    template: '%s | NexoERP',
  },
  description: 'Sistema ERP modular para PYMEs hondureñas',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <AmplifyConfigProvider>{children}</AmplifyConfigProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
