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

    // Antes era `fixed` e cobria os botões do rodapé no celular (não dava pra
    // finalizar entrega sem fechar o anúncio). Agora ele ocupa o próprio espaço
    // na página: empurra o conteúdo em vez de tampar.
    const positionClasses = {
        top: "w-full mb-4 rounded-xl overflow-hidden",
        bottom: "w-full mb-4 rounded-xl overflow-hidden",
        inline: "w-full my-4 rounded-xl overflow-hidden"
    };

    return (
        <div className={`${positionClasses[position]} bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white p-3 shadow-lg`}>
            <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
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
