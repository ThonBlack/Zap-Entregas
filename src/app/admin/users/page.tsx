import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft, Users as UsersIcon, Eye, Bike, Store, Crown, UserPlus,
} from "lucide-react";

export default async function AdminUsersListPage({
    searchParams,
}: {
    searchParams: Promise<{ role?: string; q?: string }>;
}) {
    const userId = await getSessionUserId();
    if (!userId) redirect("/login");

    const me = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, userId),
    });
    if (me?.role !== "admin") redirect("/app");

    const { role: roleFilter, q } = await searchParams;

    const all = await db.select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        email: users.email,
        role: users.role,
        plan: users.plan,
        subscriptionStatus: users.subscriptionStatus,
        isTrialUser: users.isTrialUser,
        trialEndsAt: users.trialEndsAt,
        isActive: users.isActive,
        createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt));

    const filtered = all.filter((u) => {
        if (roleFilter && roleFilter !== "all" && u.role !== roleFilter) return false;
        if (q) {
            const needle = q.toLowerCase();
            const hay = `${u.name} ${u.phone} ${u.email ?? ""}`.toLowerCase();
            if (!hay.includes(needle)) return false;
        }
        return true;
    });

    const total = all.length;
    const counts = {
        admin: all.filter((u) => u.role === "admin").length,
        shopkeeper: all.filter((u) => u.role === "shopkeeper").length,
        motoboy: all.filter((u) => u.role === "motoboy").length,
        trial: all.filter((u) => u.isTrialUser).length,
        inactive: all.filter((u) => u.isActive === false).length,
    };

    const tabBase =
        "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2";
    const activeTab = "bg-green-600 text-white";
    const inactiveTab = "bg-zinc-800 text-zinc-300 hover:bg-zinc-700";
    const isTab = (r: string) =>
        (roleFilter ?? "all") === r ? activeTab : inactiveTab;

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            <header className="bg-gradient-to-r from-green-900 to-emerald-900 border-b border-green-700 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
                    <Link
                        href="/admin"
                        className="p-2 text-green-300 hover:text-white rounded-lg hover:bg-green-800/50 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <UsersIcon size={20} /> Gerenciar Usuários
                        </h1>
                        <p className="text-green-300 text-xs">
                            {total} cadastrados • {counts.shopkeeper} lojistas • {counts.motoboy} motoboys • {counts.trial} em trial • {counts.inactive} inativos
                        </p>
                    </div>
                    <Link
                        href="/admin/users/new"
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <UserPlus size={16} />
                        Criar Usuário
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 space-y-4">
                <Card className="p-4 bg-zinc-800 border-zinc-700">
                    <form className="flex flex-wrap items-center gap-3">
                        <Link href="/admin/users" className={`${tabBase} ${isTab("all")}`}>
                            Todos ({total})
                        </Link>
                        <Link
                            href="/admin/users?role=shopkeeper"
                            className={`${tabBase} ${isTab("shopkeeper")}`}
                        >
                            <Store size={14} /> Lojistas ({counts.shopkeeper})
                        </Link>
                        <Link
                            href="/admin/users?role=motoboy"
                            className={`${tabBase} ${isTab("motoboy")}`}
                        >
                            <Bike size={14} /> Motoboys ({counts.motoboy})
                        </Link>
                        <Link
                            href="/admin/users?role=admin"
                            className={`${tabBase} ${isTab("admin")}`}
                        >
                            <Crown size={14} /> Admins ({counts.admin})
                        </Link>
                        <input
                            type="search"
                            name="q"
                            defaultValue={q ?? ""}
                            placeholder="Buscar por nome, telefone ou email..."
                            className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-600 outline-none"
                        />
                        <input type="hidden" name="role" value={roleFilter ?? ""} />
                        <button
                            type="submit"
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                            Buscar
                        </button>
                    </form>
                </Card>

                <Card className="p-0 bg-zinc-800 border-zinc-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-900/50">
                                <tr className="border-b border-zinc-700">
                                    <th className="text-left py-3 px-4 font-medium text-zinc-500">Usuário</th>
                                    <th className="text-left py-3 px-4 font-medium text-zinc-500">Telefone</th>
                                    <th className="text-left py-3 px-4 font-medium text-zinc-500">Tipo</th>
                                    <th className="text-left py-3 px-4 font-medium text-zinc-500">Plano</th>
                                    <th className="text-left py-3 px-4 font-medium text-zinc-500">Status</th>
                                    <th className="text-left py-3 px-4 font-medium text-zinc-500">Cadastro</th>
                                    <th className="text-right py-3 px-4 font-medium text-zinc-500">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-zinc-500">
                                            Nenhum usuário encontrado com esses filtros.
                                        </td>
                                    </tr>
                                )}
                                {filtered.map((u) => (
                                    <tr key={u.id} className="border-b border-zinc-800 hover:bg-zinc-700/30">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                                    u.role === "admin" ? "bg-purple-600" :
                                                    u.role === "shopkeeper" ? "bg-amber-600" : "bg-blue-600"
                                                }`}>
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-white font-medium truncate">{u.name}</div>
                                                    {u.email && <div className="text-xs text-zinc-500 truncate">{u.email}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-zinc-300 font-mono text-xs">{u.phone}</td>
                                        <td className="py-3 px-4">
                                            <Badge className={
                                                u.role === "admin" ? "bg-purple-600" :
                                                u.role === "shopkeeper" ? "bg-amber-600" : "bg-blue-600"
                                            }>
                                                {u.role === "shopkeeper" ? "Lojista" : u.role === "motoboy" ? "Motoboy" : "Admin"}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4">
                                            <Badge className={u.plan === "free" ? "bg-zinc-600" : "bg-green-600"}>
                                                {u.plan}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4">
                                            {u.isActive === false ? (
                                                <Badge className="bg-red-600">Desativado</Badge>
                                            ) : u.isTrialUser ? (
                                                <Badge className="bg-amber-600">Trial</Badge>
                                            ) : (
                                                <Badge className={u.subscriptionStatus === "active" ? "bg-green-600/60" : "bg-zinc-600"}>
                                                    {u.subscriptionStatus}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-zinc-500 text-xs">
                                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <Link
                                                href={`/admin/users/${u.id}`}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-md text-xs text-white transition-colors"
                                            >
                                                <Eye size={14} /> Detalhes
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </main>
        </div>
    );
}
