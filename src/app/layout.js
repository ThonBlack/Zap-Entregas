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

// themeColor mora AQUI (export viewport) — dentro de `metadata` o Next 15+ ignora.
// maximumScale/userScalable saíram: travavam o pinça-pra-zoom, e o motoboy no sol
// precisa poder ampliar um endereço em letra miúda.
export const viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import InstallPrompt from "@/components/shared/InstallPrompt";
import LoggerInitializer from "@/components/shared/LoggerInitializer";
import ServiceWorkerRegistrar from "@/components/shared/ServiceWorkerRegistrar";

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LoggerInitializer />
        {/* O service worker é registrado em TODA página, independente de o
            usuário ter aceitado avisos: é ele que faz o app abrir sem rede e
            que deixa o Chrome oferecer "instalar na tela inicial". */}
        <ServiceWorkerRegistrar />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
