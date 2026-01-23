import { db } from "@/db";
import { users, plans, deliveries, transactions } from "@/db/schema";
import { desc, eq, gte, and, count, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Users, CreditCard, TrendingUp, Settings, DollarSign,
    Package, AlertTriangle, Clock, UserPlus, ArrowUpRight,
    Bike, Calendar, Bell, Filter, ChevronRight, Eye
} from "lucide-react";

// Preços dos planos (para cálculo de MRR)
const PLAN_PRICES: Record<string, number> = {
    free: 0,
    basic: 19.90,
    pro: 49.90,
    growth: 79.90,
    enterprise: 199.90
};

export default async function AdminDashboardPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
    });

    if (currentUser?.role !== "admin") {
        redirect("/");
    }

    // =====================
    // BUSCAR DADOS
    // =====================

    const allPlans = await db.select().from(plans).orderBy(plans.price);

    const allUsers = await db.select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role,
        plan: users.plan,
        subscriptionStatus: users.subscriptionStatus,
        trialEndsAt: users.trialEndsAt,
        isTrialUser: users.isTrialUser,
        createdAt: users.createdAt
    }).from(users).orderBy(desc(users.createdAt));

    // Entregas
    const allDeliveries = await db.select().from(deliveries);

    // Datas para filtros
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // =====================
    // MÉTRICAS DE USUÁRIOS
    // =====================
    const totalUsers = allUsers.length;
    const shopkeepers = allUsers.filter(u => u.role === "shopkeeper").length;
    const motoboys = allUsers.filter(u => u.role === "motoboy").length;
    const freeUsers = allUsers.filter(u => u.plan === "free").length;
    const proUsers = allUsers.filter(u => u.plan === "pro").length;
    const enterpriseUsers = allUsers.filter(u => u.plan === "enterprise").length;

    // Novos usuários
    const newUsers24h = allUsers.filter(u => u.createdAt && new Date(u.createdAt) > dayAgo).length;
    const newUsers7d = allUsers.filter(u => u.createdAt && new Date(u.createdAt) > weekAgo).length;

    // Trial expirando (próximos 3 dias)
    const trialExpiring = allUsers.filter(u => {
        if (!u.isTrialUser || !u.trialEndsAt) return false;
        const trialEnd = new Date(u.trialEndsAt);
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        return trialEnd > now && trialEnd < threeDaysFromNow;
    });

    // =====================
    // MÉTRICAS FINANCEIRAS
    // =====================

    // MRR (Monthly Recurring Revenue)
    const mrr = allUsers.reduce((sum, u) => sum + (PLAN_PRICES[u.plan] || 0), 0);

    // ARR (Annual Recurring Revenue)
    const arr = mrr * 12;

    // Ticket médio (usuários pagantes)
    const payingUsers = proUsers + enterpriseUsers;
    const avgTicket = payingUsers > 0 ? mrr / payingUsers : 0;

    // Taxa de conversão (free -> pago)
    const conversionRate = totalUsers > 0 ? ((payingUsers / totalUsers) * 100).toFixed(1) : 0;

    // =====================
    // MÉTRICAS DE ENTREGAS
    // =====================
    const totalDeliveries = allDeliveries.length;
    const deliveriesToday = allDeliveries.filter(d => d.createdAt && new Date(d.createdAt) > today).length;
    const deliveriesWeek = allDeliveries.filter(d => d.createdAt && new Date(d.createdAt) > weekAgo).length;
    const deliveriesMonth = allDeliveries.filter(d => d.createdAt && new Date(d.createdAt) > monthAgo).length;
    const deliveredCount = allDeliveries.filter(d => d.status === "delivered").length;
    const canceledCount = allDeliveries.filter(d => d.status === "canceled").length;

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            {/* Header */}
            <header className="bg-gradient-to-r from-green-900 to-emerald-900 border-b border-green-700 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Painel Admin</h1>
                        <p className="text-green-300 text-sm">Gestão completa da plataforma</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/admin/master" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors">
                            🎛️ Dashboard Mestre
                        </Link>
                        <Link href="/" className="px-4 py-2 bg-zinc-700 text-white rounded-lg text-sm hover:bg-zinc-600 transition-colors">
                            ← Voltar
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 space-y-6">
                {/* ===================== */}
                {/* ALERTAS */}
                {/* ===================== */}
                {(trialExpiring.length > 0 || newUsers24h > 0) && (
                    <div className="grid md:grid-cols-2 gap-4">
                        {trialExpiring.length > 0 && (
                            <Card className="p-4 bg-amber-600/20 border-amber-600/40">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-600/30 rounded-lg flex items-center justify-center">
                                        <Clock className="text-amber-400" size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-amber-200 font-bold">{trialExpiring.length} trials expirando</p>
                                        <p className="text-amber-300/70 text-xs">Nos próximos 3 dias</p>
                                    </div>
                                    <Bell className="text-amber-400" size={20} />
                                </div>
                            </Card>
                        )}
                        {newUsers24h > 0 && (
                            <Card className="p-4 bg-green-600/20 border-green-600/40">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-600/30 rounded-lg flex items-center justify-center">
                                        <UserPlus className="text-green-400" size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-green-200 font-bold">+{newUsers24h} novos usuários</p>
                                        <p className="text-green-300/70 text-xs">Últimas 24 horas</p>
                                    </div>
                                    <ArrowUpRight className="text-green-400" size={20} />
                                </div>
                            </Card>
                        )}
                    </div>
                )}

                {/* ===================== */}
                {/* MÉTRICAS FINANCEIRAS */}
                {/* ===================== */}
                <div>
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <DollarSign size={20} className="text-green-400" />
                        Métricas Financeiras
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">MRR (Receita Mensal)</p>
                            <p className="text-2xl font-bold text-green-400">
                                R$ {mrr.toFixed(2).replace('.', ',')}
                            </p>
                        </Card>
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">ARR (Receita Anual)</p>
                            <p className="text-2xl font-bold text-white">
                                R$ {arr.toFixed(2).replace('.', ',')}
                            </p>
                        </Card>
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Ticket Médio</p>
                            <p className="text-2xl font-bold text-white">
                                R$ {avgTicket.toFixed(2).replace('.', ',')}
                            </p>
                        </Card>
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Conversão Free→Pago</p>
                            <p className="text-2xl font-bold text-purple-400">{conversionRate}%</p>
                        </Card>
                    </div>
                </div>

                {/* ===================== */}
                {/* MÉTRICAS DE USUÁRIOS */}
                {/* ===================== */}
                <div>
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Users size={20} className="text-blue-400" />
                        Métricas de Usuários
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Total</p>
                            <p className="text-2xl font-bold text-white">{totalUsers}</p>
                        </Card>
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Lojistas</p>
                            <p className="text-2xl font-bold text-amber-400">{shopkeepers}</p>
                        </Card>
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Motoboys</p>
                            <p className="text-2xl font-bold text-blue-400">{motoboys}</p>
                        </Card>
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Novos (7d)</p>
                            <p className="text-2xl font-bold text-green-400">+{newUsers7d}</p>
                        </Card>
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Por Plano</p>
                            <div className="flex gap-2 mt-1">
                                <Badge className="bg-zinc-600 text-xs">{freeUsers} free</Badge>
                                <Badge className="bg-green-600 text-xs">{proUsers} pro</Badge>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* ===================== */}
                {/* MÉTRICAS DE ENTREGAS */}
                {/* ===================== */}
                <div>
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Package size={20} className="text-purple-400" />
                        Métricas de Entregas
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Total</p>
                            <p className="text-2xl font-bold text-white">{totalDeliveries}</p>
                        </Card>
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Hoje</p>
                            <p className="text-2xl font-bold text-green-400">{deliveriesToday}</p>
                        </Card>
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Semana</p>
                            <p className="text-2xl font-bold text-blue-400">{deliveriesWeek}</p>
                        </Card>
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Mês</p>
                            <p className="text-2xl font-bold text-purple-400">{deliveriesMonth}</p>
                        </Card>
                        <Card className="p-4 bg-zinc-800 border-zinc-700">
                            <p className="text-zinc-500 text-xs mb-1">Status</p>
                            <div className="flex gap-2 mt-1">
                                <Badge className="bg-green-600 text-xs">{deliveredCount} ✓</Badge>
                                <Badge className="bg-red-600 text-xs">{canceledCount} ✗</Badge>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* ===================== */}
                {/* PLANOS */}
                {/* ===================== */}
                <Card className="p-4 bg-zinc-800 border-zinc-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <CreditCard size={20} className="text-green-400" />
                            Planos
                        </h2>
                        <Link href="/admin/plans" className="text-sm text-green-400 hover:text-green-300 flex items-center gap-1">
                            Gerenciar <ChevronRight size={16} />
                        </Link>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                        {allPlans.map(plan => (
                            <div key={plan.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-700">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-white">{plan.name}</h3>
                                    <Badge className={plan.isActive ? 'bg-green-600' : 'bg-zinc-600'}>
                                        {plan.isActive ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </div>
                                <p className="text-2xl font-bold text-green-400 mb-3">
                                    {plan.price === 0 ? 'Grátis' : `R$ ${plan.price?.toFixed(2)}`}
                                    {plan.price !== 0 && <span className="text-sm text-zinc-500">/mês</span>}
                                </p>
                                <div className="text-xs text-zinc-500 space-y-1">
                                    <p>📦 {plan.maxDeliveries === 99999 ? 'Ilimitado' : plan.maxDeliveries} entregas</p>
                                    <p>🏍️ {plan.maxMotoboys} motoboys</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* ===================== */}
                {/* USUÁRIOS */}
                {/* ===================== */}
                <Card className="p-4 bg-zinc-800 border-zinc-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Users size={20} className="text-blue-400" />
                            Usuários Recentes
                        </h2>
                        <div className="flex items-center gap-2">
                            <Badge className="bg-zinc-700 text-zinc-300">{freeUsers} free</Badge>
                            <Badge className="bg-green-600">{proUsers} pro</Badge>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-700">
                                    <th className="text-left py-2 px-3 font-medium text-zinc-500">Usuário</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-500">Telefone</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-500">Tipo</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-500">Plano</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-500">Status</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-500">Cadastro</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-500"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {allUsers.slice(0, 15).map(user => (
                                    <tr key={user.id} className="border-b border-zinc-800 hover:bg-zinc-700/30">
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                    {user.name.charAt(0)}
                                                </div>
                                                <span className="text-white font-medium">{user.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 text-zinc-400">{user.phone}</td>
                                        <td className="py-3 px-3">
                                            <Badge className={
                                                user.role === 'admin' ? 'bg-purple-600' :
                                                    user.role === 'shopkeeper' ? 'bg-amber-600' : 'bg-blue-600'
                                            }>
                                                {user.role === 'shopkeeper' ? 'Lojista' : user.role === 'motoboy' ? 'Motoboy' : 'Admin'}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-3">
                                            <Badge className={user.plan === 'free' ? 'bg-zinc-600' : 'bg-green-600'}>
                                                {user.plan}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-3">
                                            {user.isTrialUser ? (
                                                <Badge className="bg-amber-600">Trial</Badge>
                                            ) : (
                                                <Badge className={user.subscriptionStatus === 'active' ? 'bg-green-600/50' : 'bg-zinc-600'}>
                                                    {user.subscriptionStatus}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-zinc-500 text-xs">
                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="py-3 px-3">
                                            <Link href={`/admin/users/${user.id}`} className="p-2 hover:bg-zinc-700 rounded-lg transition-colors inline-flex">
                                                <Eye size={16} className="text-zinc-400" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {allUsers.length > 15 && (
                        <div className="mt-4 text-center">
                            <Link href="/admin/users" className="text-green-400 hover:text-green-300 text-sm">
                                Ver todos os {allUsers.length} usuários →
                            </Link>
                        </div>
                    )}
                </Card>
            </main>
        </div>
    );
}
