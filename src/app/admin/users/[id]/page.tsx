import { db } from "@/db";
import { users, deliveries, transactions } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft, User, Phone, Calendar, CreditCard, Package,
    DollarSign, Star, Clock, Settings, Ban, CheckCircle, Edit
} from "lucide-react";
import UserActionsForm from "./UserActionsForm";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const cookieStore = await cookies();
    const currentUserId = cookieStore.get("user_id")?.value;

    if (!currentUserId) redirect("/login");

    const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(currentUserId))
    });

    if (currentUser?.role !== "admin") {
        redirect("/");
    }

    const user = await db.query.users.findFirst({
        where: eq(users.id, Number(id))
    });

    if (!user) notFound();

    // Buscar entregas do usuário
    const userDeliveries = await db.select()
        .from(deliveries)
        .where(
            user.role === 'shopkeeper'
                ? eq(deliveries.shopkeeperId, user.id)
                : eq(deliveries.motoboyId, user.id)
        )
        .orderBy(desc(deliveries.createdAt))
        .limit(10);

    // Buscar transações do usuário
    const userTransactions = await db.select()
        .from(transactions)
        .where(eq(transactions.userId, user.id))
        .orderBy(desc(transactions.createdAt))
        .limit(10);

    // Estatísticas de entregas
    const allUserDeliveries = await db.select()
        .from(deliveries)
        .where(
            user.role === 'shopkeeper'
                ? eq(deliveries.shopkeeperId, user.id)
                : eq(deliveries.motoboyId, user.id)
        );

    const totalDeliveries = allUserDeliveries.length;
    const completedDeliveries = allUserDeliveries.filter(d => d.status === 'delivered').length;
    const canceledDeliveries = allUserDeliveries.filter(d => d.status === 'canceled').length;

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            {/* Header */}
            <header className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <Link href="/admin" className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-700 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">Detalhes do Usuário</h1>
                        <p className="text-zinc-500 text-sm">#{user.id}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Perfil */}
                <Card className="p-6 bg-zinc-800 border-zinc-700">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-zinc-700 rounded-2xl flex items-center justify-center">
                            {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.name} className="w-16 h-16 rounded-2xl object-cover" />
                            ) : (
                                <User className="text-zinc-400" size={32} />
                            )}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-white">{user.name}</h2>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge className={
                                    user.role === 'admin' ? 'bg-purple-600' :
                                        user.role === 'shopkeeper' ? 'bg-amber-600' : 'bg-blue-600'
                                }>
                                    {user.role === 'shopkeeper' ? 'Lojista' : user.role === 'motoboy' ? 'Motoboy' : 'Admin'}
                                </Badge>
                                <Badge className={user.plan === 'free' ? 'bg-zinc-600' : 'bg-green-600'}>
                                    {user.plan}
                                </Badge>
                                {user.isTrialUser && (
                                    <Badge className="bg-amber-600">Trial</Badge>
                                )}
                                <Badge className={user.subscriptionStatus === 'active' ? 'bg-green-600/50' : 'bg-red-600/50'}>
                                    {user.subscriptionStatus}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mt-6">
                        <div className="flex items-center gap-3 text-zinc-400">
                            <Phone size={18} />
                            <span>{user.phone}</span>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-400">
                            <Calendar size={18} />
                            <span>Cadastro: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '-'}</span>
                        </div>
                        {user.trialEndsAt && (
                            <div className="flex items-center gap-3 text-amber-400">
                                <Clock size={18} />
                                <span>Trial até: {new Date(user.trialEndsAt).toLocaleDateString('pt-BR')}</span>
                            </div>
                        )}
                        {user.rating && user.rating > 0 && (
                            <div className="flex items-center gap-3 text-yellow-400">
                                <Star size={18} />
                                <span>Avaliação: {user.rating.toFixed(1)} ({user.ratingCount} avaliações)</span>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Ações de Gestão */}
                <Card className="p-6 bg-zinc-800 border-zinc-700">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Settings size={20} className="text-green-400" />
                        Ações de Gestão
                    </h3>
                    <UserActionsForm user={user} />
                </Card>

                {/* Estatísticas */}
                <div className="grid md:grid-cols-3 gap-4">
                    <Card className="p-4 bg-zinc-800 border-zinc-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                                <Package className="text-blue-400" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{totalDeliveries}</p>
                                <p className="text-xs text-zinc-500">Total Entregas</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4 bg-zinc-800 border-zinc-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                                <CheckCircle className="text-green-400" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{completedDeliveries}</p>
                                <p className="text-xs text-zinc-500">Concluídas</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4 bg-zinc-800 border-zinc-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                                <Ban className="text-red-400" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{canceledDeliveries}</p>
                                <p className="text-xs text-zinc-500">Canceladas</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Últimas Entregas */}
                <Card className="p-4 bg-zinc-800 border-zinc-700">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Package size={20} className="text-purple-400" />
                        Últimas Entregas
                    </h3>
                    {userDeliveries.length === 0 ? (
                        <p className="text-zinc-500 text-center py-4">Nenhuma entrega encontrada</p>
                    ) : (
                        <div className="space-y-2">
                            {userDeliveries.map(d => (
                                <div key={d.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg">
                                    <div>
                                        <p className="text-white text-sm font-medium">{d.address}</p>
                                        <p className="text-zinc-500 text-xs">{d.createdAt ? new Date(d.createdAt).toLocaleString('pt-BR') : '-'}</p>
                                    </div>
                                    <Badge className={
                                        d.status === 'delivered' ? 'bg-green-600' :
                                            d.status === 'canceled' ? 'bg-red-600' :
                                                d.status === 'pending' ? 'bg-amber-600' : 'bg-blue-600'
                                    }>
                                        {d.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Últimas Transações */}
                <Card className="p-4 bg-zinc-800 border-zinc-700">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <DollarSign size={20} className="text-green-400" />
                        Últimas Transações
                    </h3>
                    {userTransactions.length === 0 ? (
                        <p className="text-zinc-500 text-center py-4">Nenhuma transação encontrada</p>
                    ) : (
                        <div className="space-y-2">
                            {userTransactions.map(t => (
                                <div key={t.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg">
                                    <div>
                                        <p className="text-white text-sm font-medium">{t.description || `Transação #${t.id}`}</p>
                                        <p className="text-zinc-500 text-xs">{t.createdAt ? new Date(t.createdAt).toLocaleString('pt-BR') : '-'}</p>
                                    </div>
                                    <span className={`font-bold ${t.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                                        {t.type === 'credit' ? '+' : '-'}R$ {t.amount?.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </main>
        </div>
    );
}
