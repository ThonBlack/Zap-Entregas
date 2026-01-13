import Link from "next/link";
import { Plus, Wallet, DollarSign, Package, Truck, CheckCircle, Clock, Settings, Star, Crown } from "lucide-react";
import PendingDeliveriesForm from "@/components/PendingDeliveriesForm";
import { FinancialSummary } from "./FinancialSummary";
import ProfileForm from "@/components/ProfileForm";
import AdBanner from "@/components/AdBanner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Avatar from "@/components/Avatar";

interface ShopkeeperViewProps {
    pendingDeliveries: any[];
    recentTransactions: any[];
    user: any;
}

export function ShopkeeperView({ pendingDeliveries, recentTransactions, user }: ShopkeeperViewProps) {
    const pending = pendingDeliveries.filter(d => d.status === 'pending').length;
    const inProgress = pendingDeliveries.filter(d => d.status === 'assigned' || d.status === 'picked_up').length;
    const delivered = pendingDeliveries.filter(d => d.status === 'delivered').length;
    const totalToday = pending + inProgress + delivered;
    const isFreeUser = user.plan === 'free' || !user.plan;

    return (
        <div className="space-y-6">
            <AdBanner plan={user.plan} position="top" />

            {/* Welcome Header - Verde Sólido */}
            <Card className="p-5 bg-green-600 border-green-500">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Avatar src={user.avatarUrl} name={user.name} size="lg" />
                        <div>
                            <h1 className="text-xl font-bold text-white">
                                Olá, {user.name.split(' ')[0]}! 👋
                            </h1>
                            <p className="text-sm text-green-100">
                                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-xl">
                            <Clock size={18} className="text-yellow-300" />
                            <div>
                                <p className="text-lg font-bold text-white">{pending}</p>
                                <p className="text-[10px] text-green-100 uppercase">Pendentes</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-xl">
                            <Truck size={18} className="text-yellow-300" />
                            <div>
                                <p className="text-lg font-bold text-white">{inProgress}</p>
                                <p className="text-[10px] text-green-100 uppercase">Em Rota</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-xl">
                            <CheckCircle size={18} className="text-yellow-300" />
                            <div>
                                <p className="text-lg font-bold text-white">{delivered}</p>
                                <p className="text-[10px] text-green-100 uppercase">Feitas</p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Main Actions - Verde Sólido */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Link
                    href="/routes/new"
                    className="md:col-span-2 flex items-center justify-center gap-4 w-full bg-green-500 text-white p-6 rounded-2xl font-bold shadow-lg hover:bg-green-400 active:scale-[0.98] transition-all"
                >
                    <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                        <Plus size={28} />
                    </div>
                    <div className="text-left">
                        <span className="text-lg block">Nova Entrega</span>
                        <span className="text-sm text-green-100 font-normal">Adicionar pedido rápido</span>
                    </div>
                </Link>
                <Link
                    href="/finance/new"
                    className="flex items-center justify-center gap-3 w-full bg-zinc-800 text-white border-2 border-green-600 p-4 rounded-2xl font-bold shadow-sm active:bg-zinc-700 transition-all hover:border-green-400"
                >
                    <Wallet size={22} className="text-green-400" />
                    <span className="text-sm">Pagar Motoboy</span>
                </Link>
                <Link
                    href="/finance/dashboard"
                    className="flex items-center justify-center gap-3 w-full bg-green-700 text-white p-4 rounded-2xl font-bold shadow-sm active:scale-[0.98] transition-all hover:bg-green-600"
                >
                    <DollarSign size={22} />
                    <span className="text-sm">Financeiro</span>
                </Link>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap justify-between items-center gap-4 px-1">
                <div className="flex items-center gap-2">
                    <Badge className="bg-green-600 text-white border-0">
                        📅 Hoje: {totalToday} entregas
                    </Badge>
                    {isFreeUser && (
                        <Link href="/upgrade">
                            <Badge className="bg-yellow-500 text-yellow-900 border-0 hover:bg-yellow-400 transition-colors cursor-pointer">
                                <Crown size={12} className="mr-1" />
                                Upgrade PRO
                            </Badge>
                        </Link>
                    )}
                </div>
                <div className="flex gap-4">
                    <Link href="/deliveries/history" className="text-sm font-medium text-zinc-400 hover:text-green-400 flex items-center gap-1">
                        <Package size={14} />
                        Histórico
                    </Link>
                    <Link href="/motoboys" className="text-sm font-medium text-green-400 hover:text-green-300 flex items-center gap-1">
                        <Star size={14} />
                        Motoboys
                    </Link>
                    <Link href="/settings" className="text-sm font-medium text-zinc-400 hover:text-green-400 flex items-center gap-1">
                        <Settings size={14} />
                        Config
                    </Link>
                    <Link href="/upgrade" className="text-sm font-medium text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
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

            {/* Profile (collapsed by default) */}
            <details className="bg-zinc-800 rounded-2xl border border-green-700 p-4">
                <summary className="font-bold text-white cursor-pointer flex items-center gap-2">
                    <Settings size={18} className="text-green-400" />
                    Meu Perfil
                </summary>
                <div className="mt-4">
                    <ProfileForm user={user} />
                </div>
            </details>
        </div>
    );
}
