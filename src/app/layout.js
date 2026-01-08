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
  themeColor: "#16a34a",
  viewport: "minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover",
};

import InstallPrompt from "@/components/InstallPrompt";

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
