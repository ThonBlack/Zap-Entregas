"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Bike, Store, Copy, CheckCircle, Share2, MessageCircle } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://zapentregas.duckdns.org";

type Tier = "motoboy" | "shopkeeper";

const TIERS: Record<Tier, {
    label: string;
    icon: typeof Bike;
    color: string;
    bg: string;
    border: string;
    message: string;
}> = {
    motoboy: {
        label: "Motoboy",
        icon: Bike,
        color: "text-blue-300",
        bg: "bg-blue-900/20",
        border: "border-blue-700/40",
        message: "Olá! Eu uso o Zap Entregas pra organizar as corridas. Cria sua conta de motoboy nesse link pra começar a aceitar minhas entregas:",
    },
    shopkeeper: {
        label: "Lojista",
        icon: Store,
        color: "text-amber-300",
        bg: "bg-amber-900/20",
        border: "border-amber-700/40",
        message: "Conheça o Zap Entregas — controle total das suas entregas com rastreamento GPS, dashboard financeiro e integração com seu PDV. Cria sua conta de lojista nesse link:",
    },
};

function buildInviteLink(role: Tier) {
    return `${BASE}/register?role=${role}`;
}

function buildWhatsLink(role: Tier) {
    const text = `${TIERS[role].message}\n\n${buildInviteLink(role)}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export default function InviteLinksCard() {
    const [copied, setCopied] = useState<Tier | null>(null);

    const copy = async (role: Tier) => {
        try {
            await navigator.clipboard.writeText(buildInviteLink(role));
            setCopied(role);
            setTimeout(() => setCopied(null), 2000);
        } catch {}
    };

    return (
        <Card className="p-4 bg-zinc-800 border-zinc-700">
            <div className="flex items-center gap-2 mb-4">
                <Share2 size={20} className="text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Links de Convite</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-4">
                Compartilhe estes links para que motoboys ou lojistas criem suas próprias contas — sem precisar de você.
            </p>

            <div className="grid md:grid-cols-2 gap-3">
                {(Object.keys(TIERS) as Tier[]).map((role) => {
                    const t = TIERS[role];
                    const Icon = t.icon;
                    const link = buildInviteLink(role);
                    return (
                        <div
                            key={role}
                            className={`${t.bg} ${t.border} border rounded-xl p-4 flex flex-col gap-3`}
                        >
                            <div className="flex items-center gap-2">
                                <Icon size={18} className={t.color} />
                                <span className={`font-bold ${t.color}`}>{t.label}</span>
                            </div>
                            <code className="block bg-zinc-900/60 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-zinc-300 break-all">
                                {link}
                            </code>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => copy(role)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-md text-xs font-medium"
                                >
                                    {copied === role ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                                    {copied === role ? "Copiado!" : "Copiar link"}
                                </button>
                                <a
                                    href={buildWhatsLink(role)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-xs font-medium"
                                >
                                    <MessageCircle size={14} />
                                    Compartilhar no WhatsApp
                                </a>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
