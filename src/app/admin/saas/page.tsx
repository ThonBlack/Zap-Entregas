import { db } from "@/db";
import { users, plans, subscriptions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CreditCard, TrendingUp, Settings } from "lucide-react";

export default async function AdminSaaSPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
    });

    if (currentUser?.role !== "admin") {
        redirect("/");
    }

    // Fetch all plans
    const allPlans = await db.select().from(plans).orderBy(plans.price);

    // Fetch all users with their subscription info
    const allUsers = await db.select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role,
        plan: users.plan,
        createdAt: users.createdAt
    }).from(users).orderBy(desc(users.createdAt));

    // Stats
    const totalUsers = allUsers.length;
    const shopkeepers = allUsers.filter(u => u.role === "shopkeeper").length;
    const motoboys = allUsers.filter(u => u.role === "motoboy").length;
    const freeUsers = allUsers.filter(u => u.plan === "free").length;
    const proUsers = allUsers.filter(u => u.plan === "pro").length;

    return (
        <div className="min-h-screen bg-zinc-50 p-4 md:p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">Painel Admin SaaS</h1>
                        <p className="text-zinc-500 text-sm">Gestão de planos e assinantes</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/admin/master" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors">
                            🎛️ Dashboard Mestre
                        </Link>
                        <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">
                            ← Voltar
                        </Link>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Users className="text-blue-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-zinc-900">{totalUsers}</p>
                                <p className="text-xs text-zinc-500">Total Usuários</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <CreditCard className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-zinc-900">{proUsers}</p>
                                <p className="text-xs text-zinc-500">Usuários PRO</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <TrendingUp className="text-amber-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-zinc-900">{shopkeepers}</p>
                                <p className="text-xs text-zinc-500">Lojistas</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Settings className="text-purple-600" size={20} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-zinc-900">{motoboys}</p>
                                <p className="text-xs text-zinc-500">Motoboys</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Plans Section */}
                <Card className="p-4 mb-6">
                    <h2 className="text-lg font-bold text-zinc-900 mb-4">Planos Cadastrados</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-200">
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">Nome</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">Preço</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">Max Motoboys</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">Max Entregas</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">Excedente</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allPlans.map(plan => (
                                    <tr key={plan.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                                        <td className="py-2 px-3 font-medium">{plan.name}</td>
                                        <td className="py-2 px-3">
                                            {plan.price === 0 ? (
                                                <Badge variant="secondary">Grátis</Badge>
                                            ) : (
                                                <span className="text-green-600 font-bold">R$ {plan.price?.toFixed(2)}</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-3">{plan.maxMotoboys}</td>
                                        <td className="py-2 px-3">{plan.maxDeliveries === 99999 ? "∞" : plan.maxDeliveries}</td>
                                        <td className="py-2 px-3">
                                            {plan.pricePerExtraDelivery ? `R$ ${plan.pricePerExtraDelivery?.toFixed(2)}` : "-"}
                                        </td>
                                        <td className="py-2 px-3">
                                            <Badge variant={plan.isActive ? "default" : "secondary"}>
                                                {plan.isActive ? "Ativo" : "Inativo"}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Users Section */}
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-zinc-900">Usuários</h2>
                        <Badge variant="secondary">{freeUsers} grátis / {proUsers} pagos</Badge>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-200">
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">ID</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">Nome</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">Telefone</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">Tipo</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">Plano</th>
                                    <th className="text-left py-2 px-3 font-medium text-zinc-600">Cadastro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allUsers.map(user => (
                                    <tr key={user.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                                        <td className="py-2 px-3 text-zinc-400">#{user.id}</td>
                                        <td className="py-2 px-3 font-medium">{user.name}</td>
                                        <td className="py-2 px-3">{user.phone}</td>
                                        <td className="py-2 px-3">
                                            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                                                {user.role}
                                            </Badge>
                                        </td>
                                        <td className="py-2 px-3">
                                            <Badge variant={user.plan === "free" ? "secondary" : "default"}>
                                                {user.plan}
                                            </Badge>
                                        </td>
                                        <td className="py-2 px-3 text-zinc-500 text-xs">
                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
