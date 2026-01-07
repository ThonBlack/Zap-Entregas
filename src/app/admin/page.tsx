import { db } from "@/db";
import { users, transactions, deliveries } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, Users, DollarSign, TrendingUp, Package } from "lucide-react";
import { updateUserPlanAction, updateUserStatusAction } from "@/app/actions/admin";

export default async function AdminPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(userId)),
    });

    if (!currentUser || currentUser.role !== 'admin') {
        redirect("/"); // Protect route
    }

    // Fetch All Users
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

    // Stats
    const totalUsers = allUsers.length;
    const proUsers = allUsers.filter(u => u.plan === 'pro').length;
    const totalDeliveries = await db.select({ count: sql<number>`count(*)` }).from(deliveries).get();
    const totalTransactions = await db.select({ count: sql<number>`count(*)` }).from(transactions).get();

    return (
        <div className="min-h-screen bg-slate-50 p-6 space-y-8">
            <header className="max-w-6xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Painel Super Admin</h1>
                        <p className="text-sm text-slate-500">Gestão Global do SaaS</p>
                    </div>
                </div>
                <Link href="/" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition-all">
                    Voltar ao App
                </Link>
            </header>

            {/* Stats Grid */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2 text-slate-500">
                        <Users className="w-5 h-5" />
                        <span className="text-sm font-medium">Total de Usuários</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-800">{totalUsers}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2 text-indigo-500">
                        <Shield className="w-5 h-5" />
                        <span className="text-sm font-medium">Usuários PRO</span>
                    </div>
                    <div className="text-3xl font-bold text-indigo-600">{proUsers}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2 text-emerald-500">
                        <Package className="w-5 h-5" />
                        <span className="text-sm font-medium">Entregas Totais</span>
                    </div>
                    <div className="text-3xl font-bold text-emerald-600">{totalDeliveries?.count || 0}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2 text-blue-500">
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-sm font-medium">Transações</span>
                    </div>
                    <div className="text-3xl font-bold text-blue-600">{totalTransactions?.count || 0}</div>
                </div>
            </div>

            {/* Users Table */}
            <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">Gerenciar Usuários</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Usuário</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Plano</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {allUsers.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <Link href={`/admin/users/${u.id}`} className="block group">
                                            <div className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">{u.name}</div>
                                            <div className="text-xs text-slate-500">{u.phone}</div>
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.role === 'shopkeeper' ? 'bg-orange-100 text-orange-800' :
                                            u.role === 'motoboy' ? 'bg-blue-100 text-blue-800' :
                                                'bg-purple-100 text-purple-800'
                                            }`}>
                                            {u.role === 'shopkeeper' ? 'Lojista' : u.role === 'motoboy' ? 'Motoboy' : 'Gestor'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <form action={async () => {
                                            "use server";
                                            const nextPlan = u.plan === 'free' ? 'pro' : 'free';
                                            await updateUserPlanAction(u.id, nextPlan);
                                        }}>
                                            <button className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 ${u.plan === 'pro' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                {u.plan?.toUpperCase() || 'FREE'}
                                            </button>
                                        </form>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-sm ${u.subscriptionStatus === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                                            {u.subscriptionStatus === 'active' ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            {/* Action Buttons could go here */}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
