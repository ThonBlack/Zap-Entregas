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
    const deliveriesToday = pendingDeliveries.filter(d => d.status === 'delivered').length;
    const dailyGoal = user.dailyGoal || 10; // Usar meta do banco ou padrão 10
    const progress = Math.min((deliveriesToday / dailyGoal) * 100, 100);

    // Rating e Level baseado em avaliações do banco
    const hasRating = user.ratingCount && user.ratingCount > 0;
    const rating = hasRating ? (user.ratingDelivery || user.rating || 0).toFixed(1) : null;

    // Nível baseado em avaliação média (padrão: Ouro se não tem avaliação)
    const avgRating = user.ratingDelivery || user.rating || 0;
    const level = !hasRating ? "Ouro" : avgRating >= 4.5 ? "Ouro" : avgRating >= 3.5 ? "Prata" : "Bronze";
    const levelEmoji = level === "Ouro" ? "🥇" : level === "Prata" ? "🥈" : "🥉";
    const isFreeUser = user.plan === 'free' || !user.plan;

    return (
        <div className="space-y-5">
            <AdBanner plan={user.plan} position="bottom" />

            {/* Gamified Header - Verde Sólido */}
            <Card className="p-5 bg-green-600 text-white border-0 shadow-xl overflow-hidden relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-2 right-10 text-6xl">🏍️</div>
                    <div className="absolute bottom-2 left-10 text-5xl">⚡</div>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative">
                            {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40 shadow-lg" />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
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
                                <Badge className="bg-white/30 text-white border-0 text-xs font-bold">
                                    {levelEmoji} {level}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-white/90">
                                <span className="flex items-center gap-1">
                                    <Star size={14} fill="currentColor" /> {rating || 'Sem avaliação'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MapPin size={14} /> Online
                                </span>
                            </div>
                        </div>
                        {isFreeUser && (
                            <Link href="/upgrade" className="flex items-center gap-1 bg-yellow-400 text-yellow-900 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-yellow-300 transition-colors">
                                <Crown size={14} />
                                PRO
                            </Link>
                        )}
                    </div>

                    {/* Daily Goal Progress */}
                    <div className="bg-white/20 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium flex items-center gap-2">
                                <Target size={16} />
                                Meta do dia: {deliveriesToday}/{dailyGoal} entregas
                            </span>
                            <span className="text-xs bg-white/30 px-2 py-0.5 rounded-full font-bold">
                                {progress >= 100 ? "🎉 Meta batida!" : `${Math.round(progress)}%`}
                            </span>
                        </div>
                        <div className="w-full bg-white/30 rounded-full h-3">
                            <div
                                className="bg-yellow-400 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* LocationTracker - Apenas para planos pagos */}
            {!isFreeUser && <LocationTracker />}

            {/* Balance Cards - Verde Sólido */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 bg-green-700 border-green-600">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-md">
                            <DollarSign className="text-white" size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-green-200 font-medium uppercase">Saldo</p>
                            <p className="text-2xl font-bold text-white">
                                {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 bg-green-700 border-green-600">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                            <Flame className="text-white" size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-green-200 font-medium uppercase">Hoje</p>
                            <p className="text-2xl font-bold text-white">
                                {deliveriesToday} <span className="text-sm font-normal text-green-200">entregas</span>
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Quick Actions - Verde */}
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/finance/dashboard"
                    className="flex items-center justify-center gap-3 w-full bg-green-600 text-white p-4 rounded-2xl font-bold shadow-md active:scale-[0.98] transition-all hover:bg-green-500"
                >
                    <DollarSign size={22} />
                    <span className="text-sm">Financeiro</span>
                </Link>
                <Link
                    href="/deliveries/history"
                    className="flex items-center justify-center gap-3 w-full bg-zinc-800 border-2 border-green-600 text-white p-4 rounded-2xl font-bold shadow-sm active:scale-[0.98] transition-all hover:bg-zinc-700"
                >
                    <History size={22} className="text-green-400" />
                    <span className="text-sm">Histórico</span>
                </Link>
            </div>

            {/* Link to Upgrade */}
            {isFreeUser && (
                <Link href="/upgrade" className="block">
                    <Card className="p-4 bg-yellow-500 border-yellow-400 hover:bg-yellow-400 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-yellow-600 rounded-xl flex items-center justify-center">
                                    <Crown className="text-white" size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-yellow-900">Seja PRO! 🚀</p>
                                    <p className="text-xs text-yellow-800">Remova anúncios e desbloqueie recursos</p>
                                </div>
                            </div>
                            <span className="text-yellow-900 font-bold text-sm">Ver Planos →</span>
                        </div>
                    </Card>
                </Link>
            )}

            {/* Pending Deliveries */}
            <section>
                <PendingDeliveriesForm deliveries={pendingDeliveries} />
            </section>

            {/* Motivational Footer */}
            {deliveriesToday >= dailyGoal && (
                <Card className="p-4 bg-green-600 border-green-500 text-center">
                    <div className="flex items-center justify-center gap-2 text-white font-bold">
                        <Trophy size={20} />
                        Parabéns! Você bateu a meta de hoje! 🎉
                    </div>
                </Card>
            )}
        </div>
    );
}
