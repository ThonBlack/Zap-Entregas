import Link from "next/link";
import { Plus, Wallet, DollarSign, Package, Truck, CheckCircle, Clock, Settings, Star, Crown } from "lucide-react";
import PendingDeliveriesForm from "@/components/PendingDeliveriesForm";
import { FinancialSummary } from "./FinancialSummary";
import ProfileForm from "@/components/ProfileForm";
import AdBanner from "@/components/AdBanner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ShopkeeperViewProps {
    pendingDeliveries: any[];
    recentTransactions: any[];
    user: any;
}

export function ShopkeeperView({ pendingDeliveries, recentTransactions, user }: ShopkeeperViewProps) {
    // Calculate stats
    const pending = pendingDeliveries.filter(d => d.status === 'pending').length;
    const inProgress = pendingDeliveries.filter(d => d.status === 'assigned' || d.status === 'picked_up').length;
    const delivered = pendingDeliveries.filter(d => d.status === 'delivered').length;
    const totalToday = pending + inProgress + delivered;
    const isFreeUser = user.plan === 'free' || !user.plan;

    return (
        <div className="space-y-6">
            <AdBanner plan={user.plan} position="top" />

            {/* Welcome Header with Stats */}
            <Card className="p-5 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border-green-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md" />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-xl font-bold shadow-md">
                                {user.name.charAt(0)}
                            </div>
                        )}
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900">
                                Olá, {user.name.split(' ')[0]}! 👋
                            </h1>
                            <p className="text-sm text-zinc-500">
                                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-sm">
                            <Clock size={18} className="text-amber-500" />
                            <div>
                                <p className="text-lg font-bold text-zinc-900">{pending}</p>
                                <p className="text-[10px] text-zinc-500 uppercase">Pendentes</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-sm">
                            <Truck size={18} className="text-green-500" />
                            <div>
                                <p className="text-lg font-bold text-zinc-900">{inProgress}</p>
                                <p className="text-[10px] text-zinc-500 uppercase">Em Rota</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-sm">
                            <CheckCircle size={18} className="text-green-600" />
                            <div>
                                <p className="text-lg font-bold text-zinc-900">{delivered}</p>
                                <p className="text-[10px] text-zinc-500 uppercase">Feitas</p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Main Actions - Nova Entrega destacado */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Link
                    href="/routes/new"
                    className="md:col-span-2 flex items-center justify-center gap-4 w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <Plus size={28} />
                    </div>
                    <div className="text-left">
                        <span className="text-lg block">Nova Entrega</span>
                        <span className="text-sm text-green-100 font-normal">Adicionar pedido rápido</span>
                    </div>
                </Link>
                <Link
                    href="/finance/new"
                    className="flex items-center justify-center gap-3 w-full bg-white text-zinc-700 border-2 border-zinc-200 p-4 rounded-2xl font-bold shadow-sm active:bg-zinc-50 transition-all hover:border-green-300 hover:shadow-md"
                >
                    <Wallet size={22} className="text-green-500" />
                    <span className="text-sm">Pagar Motoboy</span>
                </Link>
                <Link
                    href="/finance/dashboard"
                    className="flex items-center justify-center gap-3 w-full bg-gradient-to-br from-green-600 to-emerald-700 text-white p-4 rounded-2xl font-bold shadow-sm active:scale-[0.98] transition-all hover:shadow-md"
                >
                    <DollarSign size={22} />
                    <span className="text-sm">Financeiro</span>
                </Link>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap justify-between items-center gap-4 px-1">
                <div className="flex items-center gap-2">
                    <Badge variant="success" className="animate-pulse">
                        📅 Hoje: {totalToday} entregas
                    </Badge>
                    {isFreeUser && (
                        <Link href="/upgrade">
                            <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 hover:scale-105 transition-transform cursor-pointer">
                                <Crown size={12} className="mr-1" />
                                Upgrade PRO
                            </Badge>
                        </Link>
                    )}
                </div>
                <div className="flex gap-4">
                    <Link href="/deliveries/history" className="text-sm font-medium text-zinc-500 hover:text-green-600 flex items-center gap-1">
                        <Package size={14} />
                        Histórico
                    </Link>
                    <Link href="/motoboys" className="text-sm font-medium text-green-600 hover:text-green-700 flex items-center gap-1">
                        <Star size={14} />
                        Motoboys
                    </Link>
                    <Link href="/settings" className="text-sm font-medium text-zinc-500 hover:text-green-600 flex items-center gap-1">
                        <Settings size={14} />
                        Config
                    </Link>
                    <Link href="/upgrade" className="text-sm font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1">
                        <Crown size={14} />
                        Planos
                    </Link>
                </div>
            </div>

            {/* Pending Deliveries */}
            <section>
                <PendingDeliveriesForm deliveries={pendingDeliveries} />
            </section>

            {/* Financial Summary */}
            <section>
                <FinancialSummary transactions={recentTransactions} />
            </section>

            {/* Profile (collapsed by default in mobile) */}
            <details className="bg-white rounded-2xl border border-zinc-200 p-4">
                <summary className="font-bold text-zinc-900 cursor-pointer flex items-center gap-2">
                    <Settings size={18} />
                    Meu Perfil
                </summary>
                <div className="mt-4">
                    <ProfileForm user={user} />
                </div>
            </details>
        </div>
    );
}
