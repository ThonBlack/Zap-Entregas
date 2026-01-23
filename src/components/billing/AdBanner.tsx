"use client";

import { X, Sparkles } from "lucide-react";
import { useState } from "react";

interface AdBannerProps {
    plan?: string;
    position?: "top" | "bottom" | "inline";
}

export default function AdBanner({ plan = "free", position = "bottom" }: AdBannerProps) {
    const [dismissed, setDismissed] = useState(false);

    // Don't show ads for paid users
    if (plan !== "free" || dismissed) return null;

    const positionClasses = {
        top: "fixed top-0 left-0 right-0 z-40",
        bottom: "fixed bottom-0 left-0 right-0 z-40",
        inline: "w-full my-4"
    };

    return (
        <div className={`${positionClasses[position]} bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white p-3 shadow-lg`}>
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Sparkles size={20} className="animate-pulse" />
                    <div>
                        <p className="text-sm font-bold">
                            🚀 Upgrade para PRO e remova os anúncios!
                        </p>
                        <p className="text-xs opacity-90">
                            Entregas ilimitadas + Rotas otimizadas + Suporte prioritário
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href="/upgrade"
                        className="bg-white text-orange-600 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-orange-100 transition-colors"
                    >
                        Ver Planos
                    </a>
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1 hover:bg-white/20 rounded"
                        title="Fechar"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Inline ad for between deliveries or in lists
export function InlineAd({ plan = "free" }: { plan?: string }) {
    if (plan !== "free") return null;

    const ads = [
        { text: "Patrocinado: Capacetes com 20% OFF!", link: "#", sponsor: "MotoShop" },
        { text: "Seguro para Motoboys - Contrate agora!", link: "#", sponsor: "SeguroExpress" },
        { text: "Ganhe cashback em combustível!", link: "#", sponsor: "PostoVIP" },
    ];

    const randomAd = ads[Math.floor(Math.random() * ads.length)];

    return (
        <div className="bg-zinc-100 border border-zinc-200 rounded-lg p-3 my-2 flex items-center justify-between">
            <div>
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Patrocinado</span>
                <p className="text-sm text-zinc-700 font-medium">{randomAd.text}</p>
                <span className="text-xs text-zinc-500">por {randomAd.sponsor}</span>
            </div>
            <a
                href={randomAd.link}
                className="bg-zinc-800 text-white px-3 py-1 rounded text-xs font-bold hover:bg-zinc-700"
            >
                Ver
            </a>
        </div>
    );
}
