import Link from "next/link";
import { db } from "@/db";
import { users, transactions, deliveries } from "@/db/schema";
import { eq, sql, desc, and, or, gte, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSessionUserId, clearSessionCookie } from "@/lib/session";
import { LogOut, ShieldCheck, Settings, Store, Bike, Crown } from "lucide-react";

import { ShopkeeperView } from "@/components/dashboard/ShopkeeperView";
import { MotoboyView } from "@/components/dashboard/MotoboyView";
import { PendingConfirmations } from "@/components/dashboard/PendingConfirmations";
import TrialBanner from "@/components/billing/TrialBanner";
import NotificationWrapper from "@/components/shared/NotificationWrapper";

async function getUserBalance(userId: number) {
    const result = await db
        .select({
            balance: sql<number>`
        COALESCE(SUM(
          CASE
            WHEN ${transactions.status} = 'confirmed' AND ${transactions.type} = 'credit' THEN ${transactions.amount}
            WHEN ${transactions.status} = 'confirmed' AND ${transactions.type} = 'debit' THEN -${transactions.amount}
            ELSE 0
          END
        ), 0)
      `,
        })
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .get();

    return result?.balance || 0;
}

async function getPendingConfirmations(userId: number) {
    const result = await db.select({
        id: transactions.id,
        amount: transactions.amount,
        type: transactions.type,
        description: transactions.description,
        createdAt: transactions.createdAt,
        creatorName: users.name,
    })
        .from(transactions)
        .leftJoin(users, eq(transactions.creatorId, users.id))
        .where(
            and(
                eq(transactions.userId, userId),
                eq(transactions.status, "pending"),
                sql`${transactions.creatorId} != ${userId}`
            )
        )
        .orderBy(desc(transactions.createdAt));

    return result as { id: number; amount: number; type: "credit" | "debit"; description: string; createdAt: string; creatorName: string | null }[];
}

async function getRecentTransactions() {
    const result = await db.select({
        id: transactions.id,
        amount: transactions.amount,
        type: transactions.type,
        description: transactions.description,
        createdAt: transactions.createdAt,
        userName: users.name,
        status: transactions.status,
    })
        .from(transactions)
        .leftJoin(users, eq(transactions.userId, users.id))
        .orderBy(desc(transactions.createdAt))
        .limit(10);

    return result as { id: number; amount: number; type: "credit" | "debit"; description: string; createdAt: string; userName: string; status: string }[];
}

export default async function Dashboard({
    searchParams,
}: {
    searchParams: Promise<{ as?: string }>;
}) {
    const userId = await getSessionUserId();
    if (!userId) redirect("/login");

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) redirect("/login");

    if (user.isTrialUser && user.trialEndsAt) {
        const trialEnd = new Date(user.trialEndsAt);
        if (trialEnd < new Date()) {
            await db.update(users)
                .set({
                    plan: "free",
                    isTrialUser: false,
                    subscriptionStatus: "active",
                })
                .where(eq(users.id, user.id));

            user.plan = "free";
            user.isTrialUser = false;
            user.subscriptionStatus = "active";
        }
    }

    // Admin pode escolher ver como lojista (padrão) ou motoboy via ?as=motoboy
    const asView = (await searchParams).as;
    const isAdminViewingAsMotoboy = user.role === "admin" && asView === "motoboy";

    let myBalance = 0;
    let pendingDeliveries: any[] = [];
    let myDeliveries: any[] = [];
    let deliveriesTodayCount = 0;
    let recentTransactions: Awaited<ReturnType<typeof getRecentTransactions>> = [];

    const pendingConfirmations = await getPendingConfirmations(user.id);
    const isShopkeeperOrAdmin =
        !isAdminViewingAsMotoboy &&
        (user.role === "shopkeeper" || (user.role as string) === "admin");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isShopkeeperOrAdmin) {
        recentTransactions = await getRecentTransactions();
        const pendingWhere = (user.role as string) === "admin"
            ? eq(deliveries.status, "pending")
            : and(eq(deliveries.status, "pending"), eq(deliveries.shopkeeperId, user.id));
        pendingDeliveries = await db.select()
            .from(deliveries)
            .where(pendingWhere)
            .orderBy(deliveries.stopOrder, desc(deliveries.createdAt));
    } else {
        myBalance = await getUserBalance(user.id);

        pendingDeliveries = await db.select()
            .from(deliveries)
            .where(
                or(
                    eq(deliveries.status, "pending"),
                    and(
                        eq(deliveries.motoboyId, user.id),
                        inArray(deliveries.status, ["assigned", "picked_up"])
                    )
                )
            )
            .orderBy(deliveries.stopOrder);

        myDeliveries = pendingDeliveries.filter(d => d.motoboyId === user.id);

        const todayDelivered = await db.select({ count: sql<number>`count(*)` })
            .from(deliveries)
            .where(and(
                eq(deliveries.motoboyId, user.id),
                eq(deliveries.status, "delivered"),
                gte(deliveries.deliveredAt, today.toISOString())
            ));
        deliveriesTodayCount = todayDelivered[0]?.count || 0;
    }

    return (
        <div className="min-h-screen bg-zinc-900 pb-20 md:pb-8">
            {user.role === "admin" && (
                <div className="bg-gradient-to-r from-purple-900/80 to-purple-800/80 border-b border-purple-700 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 text-purple-100">
                        <Crown size={16} className="text-yellow-300" />
                        <span>Modo admin — vendo como <strong>{isAdminViewingAsMotoboy ? "Motoboy" : "Lojista"}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/app"
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${!isAdminViewingAsMotoboy ? "bg-amber-600/40 text-amber-100" : "bg-zinc-800/40 text-purple-200 hover:bg-zinc-800/70"}`}
                        >
                            <Store size={14} />
                            Lojista
                        </Link>
                        <Link
                            href="/app?as=motoboy"
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${isAdminViewingAsMotoboy ? "bg-blue-600/40 text-blue-100" : "bg-zinc-800/40 text-purple-200 hover:bg-zinc-800/70"}`}
                        >
                            <Bike size={14} />
                            Motoboy
                        </Link>
                        <Link href="/admin" className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-zinc-800/40 text-purple-200 hover:bg-zinc-800/70 transition-colors">
                            ← Painel Admin
                        </Link>
                    </div>
                </div>
            )}
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-md">
                <div>
                    <h1 className="text-xl font-bold text-white truncate">Olá, {user.name}</h1>
                    <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
                        {user.role === "shopkeeper" ? "Lojista" : (user.role as string) === "admin" ? (isAdminViewingAsMotoboy ? "Administrador (vista Motoboy)" : "Administrador (vista Lojista)") : "Motoboy"}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {(user.role === "shopkeeper" || (user.role === "admin" && !isAdminViewingAsMotoboy)) && (
                        <Link href="/settings" className="p-2 text-zinc-400 hover:text-green-400 transition-colors" title="Configurações da Loja">
                            <Settings size={20} />
                        </Link>
                    )}
                    {(user.role === "motoboy" || (user.role === "admin" && isAdminViewingAsMotoboy)) && (
                        <Link href="/settings/motoboy" className="p-2 text-zinc-400 hover:text-green-400 transition-colors" title="Minhas Configurações">
                            <Settings size={20} />
                        </Link>
                    )}
                    <Link href="/security/2fa-setup" className="p-2 text-zinc-400 hover:text-green-400 transition-colors" title="Segurança / 2FA">
                        <ShieldCheck size={20} />
                    </Link>
                    <form action={async () => {
                        "use server";
                        await clearSessionCookie();
                        redirect("/login");
                    }}>
                        <button className="p-2 text-zinc-400 hover:text-red-400 transition-colors" title="Sair">
                            <LogOut size={20} />
                        </button>
                    </form>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
                <TrialBanner trialEndsAt={user.trialEndsAt ?? null} isTrialUser={user.isTrialUser ?? false} />
                <PendingConfirmations confirmations={pendingConfirmations} />

                {isShopkeeperOrAdmin ? (
                    <ShopkeeperView
                        pendingDeliveries={pendingDeliveries}
                        recentTransactions={recentTransactions}
                        user={user}
                    />
                ) : (
                    <MotoboyView
                        balance={myBalance}
                        pendingDeliveries={pendingDeliveries}
                        myDeliveries={myDeliveries}
                        deliveriesToday={deliveriesTodayCount}
                        user={user}
                    />
                )}
            </main>

            <NotificationWrapper
                userId={user.id}
                userRole={user.role as "motoboy" | "shopkeeper" | "admin"}
            />
        </div>
    );
}
