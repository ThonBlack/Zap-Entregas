import Link from "next/link";
import { DollarSign, History, Target, Flame, Star, Trophy, Zap, MapPin, Crown } from "lucide-react";
import PendingDeliveriesForm from "@/components/PendingDeliveriesForm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LocationTracker from "@/components/LocationTracker";
import AdBanner from "@/components/AdBanner";

interface MotoboyViewProps {
    balance: number;
    pendingDeliveries: any[];
    user: any;
}

export function MotoboyView({ balance, pendingDeliveries, user }: MotoboyViewProps) {
    // Simulated gamification data (would come from DB in production)
    const deliveriesToday = pendingDeliveries.filter(d => d.status === 'delivered').length;
    const dailyGoal = 10;
    const progress = Math.min((deliveriesToday / dailyGoal) * 100, 100);
    const level = deliveriesToday >= 15 ? "Ouro" : deliveriesToday >= 10 ? "Prata" : "Bronze";
    const levelEmoji = deliveriesToday >= 15 ? "🥇" : deliveriesToday >= 10 ? "🥈" : "🥉";
    const rating = 4.9;
    const isFreeUser = user.plan === 'free' || !user.plan;

    return (
        <div className="space-y-5">
            <AdBanner plan={user.plan} position="bottom" />

            {/* Gamified Header - Verde (Identidade Visual) */}
            <Card className="p-5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white border-0 shadow-xl overflow-hidden relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-2 right-10 text-6xl">🏍️</div>
                    <div className="absolute bottom-2 left-10 text-5xl">⚡</div>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative">
                            {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.name} className="w-18 h-18 rounded-2xl object-cover border-3 border-white/30 shadow-lg" style={{ width: 72, height: 72 }} />
                            ) : (
                                <div className="w-18 h-18 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold" style={{ width: 72, height: 72 }}>
                                    {user.name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-yellow-400 border-2 border-white rounded-full flex items-center justify-center text-xs">
                                ✓
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-xl font-bold">{user.name}</h2>
                                <Badge className="bg-white/20 text-white border-0 text-xs">
                                    {levelEmoji} {level}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-white/80">
                                <span className="flex items-center gap-1">
                                    <Star size={14} fill="currentColor" /> {rating}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MapPin size={14} /> Online
                                </span>
                            </div>
                        </div>
                        {/* Upgrade Link */}
                        {isFreeUser && (
                            <Link href="/upgrade" className="flex items-center gap-1 bg-yellow-400 text-yellow-900 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-yellow-300 transition-colors">
                                <Crown size={14} />
                                PRO
                            </Link>
                        )}
                    </div>

                    {/* Daily Goal Progress */}
                    <div className="bg-white/10 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium flex items-center gap-2">
                                <Target size={16} />
                                Meta do dia: {deliveriesToday}/{dailyGoal} entregas
                            </span>
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                {progress >= 100 ? "🎉 Meta batida!" : `${Math.round(progress)}%`}
                            </span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-3">
                            <div
                                className="bg-gradient-to-r from-yellow-300 to-green-300 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </Card>

            <LocationTracker />

            {/* Balance Card - Compact */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-100 border-green-200">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-md">
                            <DollarSign className="text-white" size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-green-600 font-medium uppercase">Saldo</p>
                            <p className="text-2xl font-bold text-green-700">
                                {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-green-50 to-teal-100 border-green-200">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center shadow-md">
                            <Flame className="text-white" size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-teal-600 font-medium uppercase">Hoje</p>
                            <p className="text-2xl font-bold text-teal-700">
                                {deliveriesToday} <span className="text-sm font-normal">entregas</span>
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/finance/dashboard"
                    className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-2xl font-bold shadow-md active:scale-[0.98] transition-all hover:shadow-lg"
                >
                    <DollarSign size={22} />
                    <span className="text-sm">Financeiro</span>
                </Link>
                <Link
                    href="/deliveries/history"
                    className="flex items-center justify-center gap-3 w-full bg-white border-2 border-green-200 text-zinc-700 p-4 rounded-2xl font-bold shadow-sm active:scale-[0.98] transition-all hover:border-green-400 hover:text-green-600"
                >
                    <History size={22} className="text-green-500" />
                    <span className="text-sm">Histórico</span>
                </Link>
            </div>

            {/* Link to Upgrade */}
            {isFreeUser && (
                <Link href="/upgrade" className="block">
                    <Card className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                                    <Crown className="text-white" size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-zinc-900">Seja PRO! 🚀</p>
                                    <p className="text-xs text-zinc-500">Remova anúncios e desbloqueie recursos</p>
                                </div>
                            </div>
                            <span className="text-amber-600 font-bold text-sm">Ver Planos →</span>
                        </div>
                    </Card>
                </Link>
            )}

            {/* Pending Deliveries */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                        <Zap size={18} className="text-green-500" />
                        Próximas Entregas
                    </h3>
                    {pendingDeliveries.length > 0 && (
                        <Badge variant="success" className="animate-pulse">
                            {pendingDeliveries.filter(d => d.status !== 'delivered').length} pendentes
                        </Badge>
                    )}
                </div>
                <PendingDeliveriesForm deliveries={pendingDeliveries} />
            </section>

            {/* Motivational Footer */}
            {deliveriesToday >= dailyGoal && (
                <Card className="p-4 bg-gradient-to-r from-green-100 to-emerald-100 border-green-300 text-center">
                    <div className="flex items-center justify-center gap-2 text-green-700 font-bold">
                        <Trophy size={20} />
                        Parabéns! Você bateu a meta de hoje! 🎉
                    </div>
                </Card>
            )}
        </div>
    );
}
