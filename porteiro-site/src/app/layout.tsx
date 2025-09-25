'use client';
import { Geist, Geist_Mono } from "next/font/google";
import { useEffect } from 'react';
import "./globals.css";
import { AuthProvider } from '@/utils/useAuth';
import { Toaster } from 'sonner';
import { NotificationProvider } from '@/components/NotificationSystem';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    // Remove atributos adicionados por extensões do navegador após a hidratação
    // para evitar erros de hydration mismatch
    const body = document.body;
    if (body) {
      // Remove atributos comuns de extensões
      body.removeAttribute('cz-shortcut-listen');
      body.removeAttribute('data-new-gr-c-s-check-loaded');
      body.removeAttribute('data-gr-ext-installed');
    }
  }, []);

  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <AuthProvider>
          <NotificationProvider>
            {children}
            <Toaster 
              position="top-right"
              richColors
              closeButton
              duration={4000}
            />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
