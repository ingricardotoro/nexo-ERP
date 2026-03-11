import { Inter, JetBrains_Mono } from 'next/font/google';

import AmplifyConfigProvider from '@/lib/amplify/config';

import './globals.css';

import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
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
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <AmplifyConfigProvider>{children}</AmplifyConfigProvider>
      </body>
    </html>
  );
}
