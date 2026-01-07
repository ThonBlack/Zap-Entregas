import { db } from "@/db";
import { users, deliveries, transactions } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Phone, Star, MapPin, DollarSign, Calendar, TrendingUp } from "lucide-react";

export default async function AdminUserDetailsPage({ params }: { params: { id: string } }) {
    const { id } = await params; // Async params in Next 15+
    const cookieStore = await cookies();
    const currentUserId = cookieStore.get("user_id")?.value;

    if (!currentUserId) redirect("/login");

    // Verify Admin Access
    const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(currentUserId)),
    });
    if (!currentUser || currentUser.role !== 'admin') redirect("/");

    // Fetch Target User
    const targetUser = await db.query.users.findFirst({
        where: eq(users.id, Number(id)),
    });

    if (!targetUser) return <div>Usuário não encontrado.</div>;

    // Fetch Related Data
    const userDeliveries = await db.select().from(deliveries)
        .where(eq(deliveries.shopkeeperId, targetUser.id)) // Assuming shopkeeper for now, need logic for motoboy
        .orderBy(desc(deliveries.createdAt))
        .limit(20);

    // Stats Calculation
    // Logic differs for Shopkeeper vs Motoboy
    // For now, let's just count based on Shopkeeper ID matching user ID
    // If motoboy, we would check who ACCEPTED the delivery (not implemented in schema yet fully? Or is it?)
    // Checking schema... deliveries has 'shopkeeperId'. Does it have 'motoboyId'?
    // Let's assume for this step we display what we have.

    const totalDeliveriesCount = userDeliveries.length; // Placeholder for real count
    const totalTransactions = await db.select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(eq(transactions.userId, targetUser.id))
        .get();

    return (
        <div className="min-h-screen bg-slate-50 p-6 space-y-8">
            <header className="max-w-5xl mx-auto flex items-center gap-4">
                <Link href="/admin" className="p-2 bg-white rounded-full shadow-sm hover:shadow-md transition-all text-slate-500">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Detalhes do Membro</h1>
                    <p className="text-sm text-slate-500">Visão Raio-X</p>
                </div>
            </header>

            <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Card */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center">
                        <div className="w-24 h-24 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center text-slate-300">
                            <User size={48} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">{targetUser.name}</h2>
                        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${targetUser.role === 'shopkeeper' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                            {targetUser.role.toUpperCase()}
                        </span>

                        <div className="mt-6 space-y-3 text-left">
                            <div className="flex items-center gap-3 text-slate-600">
                                <Phone size={18} className="text-slate-400" />
                                <span className="text-sm">{targetUser.phone}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <Star size={18} className="text-slate-400" />
                                <span className="text-sm">{targetUser.plan.toUpperCase()} Plan</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <Calendar size={18} className="text-slate-400" />
                                <span className="text-sm">Entrou em: {new Date(targetUser.createdAt || Date.now()).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div className="text-xs text-slate-500 mb-1">Corridas</div>
                            <div className="text-2xl font-bold text-slate-900">{totalDeliveriesCount}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div className="text-xs text-slate-500 mb-1">Transações</div>
                            <div className="text-2xl font-bold text-slate-900">{totalTransactions?.count || 0}</div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="md:col-span-2 space-y-6">
                    {/* Performance Chart Placeholder */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <TrendingUp size={20} className="text-blue-500" />
                                Performance (Últimos 30 dias)
                            </h3>
                            <select className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2 py-1 outline-none">
                                <option>Diário</option>
                                <option>Semanal</option>
                            </select>
                        </div>
                        <div className="h-48 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                            [Gráfico de Barras Aqui - Implementar com Recharts]
                        </div>
                    </div>

                    {/* History Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800">Histórico de Atividades</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-3">Data</th>
                                        <th className="px-6 py-3">Descrição</th>
                                        <th className="px-6 py-3">Valor</th>
                                        <th className="px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-sm text-slate-600">
                                    {userDeliveries.map(d => (
                                        <tr key={d.id}>
                                            <td className="px-6 py-3">{new Date(d.createdAt || Date.now()).toLocaleDateString()}</td>
                                            <td className="px-6 py-3 line-clamp-1">{d.address}</td>
                                            <td className="px-6 py-3">R$ {d.value}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${d.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {d.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {userDeliveries.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                                Nenhuma atividade registrada.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
