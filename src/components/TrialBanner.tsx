"use client";

import { Gift, Clock, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface TrialBannerProps {
    trialEndsAt: string | null;
    isTrialUser: boolean;
}

export default function TrialBanner({ trialEndsAt, isTrialUser }: TrialBannerProps) {
    const [dismissed, setDismissed] = useState(false);

    if (!isTrialUser || !trialEndsAt || dismissed) return null;

    const now = new Date();
    const endDate = new Date(trialEndsAt);
    const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Não mostrar se o trial já acabou
    if (daysLeft <= 0) return null;

    // Visual urgente se restam 7 dias ou menos
    const isUrgent = daysLeft <= 7;

    return (
        <div className={`relative rounded-2xl p-4 mb-4 flex items-center justify-between ${daysLeft <= 3
            ? 'bg-gradient-to-r from-red-600 to-orange-600'
            : 'bg-gradient-to-r from-amber-500 to-orange-500'
            }`}>
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                    {daysLeft <= 3 ? <Clock size={24} className="text-white" /> : <Gift size={24} className="text-white" />}
                </div>
                <div>
                    <p className="font-bold text-white">
                        {daysLeft <= 3
                            ? `⚠️ Seu trial acaba em ${daysLeft} dia${daysLeft === 1 ? '' : 's'}!`
                            : `🎁 ${daysLeft} dias restantes do seu trial`
                        }
                    </p>
                    <p className="text-sm text-white/80">
                        {daysLeft <= 3
                            ? 'Assine agora para não perder acesso!'
                            : 'Aproveite todos os recursos do plano Unlimited'
                        }
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Link
                    href="/upgrade"
                    className="bg-white text-orange-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-orange-50 transition-colors"
                >
                    Assinar Agora
                </Link>
                <button
                    onClick={() => setDismissed(true)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                    <X size={18} className="text-white" />
                </button>
            </div>
        </div>
    );
}
