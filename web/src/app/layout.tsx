import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from './providers';
import { Toaster } from '@/components/ui';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kotiz - Tableau de bord",
  description: "Gestion des associations et des cotisations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <Script 
          src="https://accounts.google.com/gsi/client" 
          strategy="afterInteractive"
        />
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
