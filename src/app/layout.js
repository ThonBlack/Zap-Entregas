import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Zap Entregas",
  description: "Gestão inteligente de entregas",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

import InstallPrompt from "@/components/shared/InstallPrompt";
import LoggerInitializer from "@/components/shared/LoggerInitializer";

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LoggerInitializer />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
