import Link from "next/link";
import { db } from "@/db";
import { users, transactions, deliveries, shopSettings } from "@/db/schema";
import { eq, sql, desc, and, or, gte, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSessionUserId, clearSessionCookie } from "@/lib/session";
import { LogOut, ShieldCheck, Settings, Store, Bike, Crown } from "lucide-react";
import { isAddressSuspicious } from "@/lib/routeUtils";

type VisibilityFlags = {
    showCustomerName: boolean;
    showCustomerPhone: boolean;
    showOrderValue: boolean;
    showObservation: boolean;
};

const DEFAULT_VISIBILITY: VisibilityFlags = {
    showCustomerName: true,
    showCustomerPhone: true,
    showOrderValue: false,
    showObservation: true,
};

function applyVisibility<T extends {
    shopkeeperId: number | null;
    customerName: string | null;
    customerPhone: string | null;
    value: number | null;
    observation: string | null;
}>(deliveries: T[], visibilityByShop: Map<number, VisibilityFlags>): T[] {
    return deliveries.map((d) => {
        const v = (d.shopkeeperId != null && visibilityByShop.get(d.shopkeeperId)) || DEFAULT_VISIBILITY;
        return {
            ...d,
            customerName: v.showCustomerName ? d.customerName : null,
            customerPhone: v.showCustomerPhone ? d.customerPhone : null,
            value: v.showOrderValue ? d.value : null,
            observation: v.showObservation ? d.observation : null,
        };
    });
}

import { ShopkeeperView } from "@/components/dashboard/ShopkeeperView";
import { MotoboyView } from "@/components/dashboard/MotoboyView";
import { PendingConfirmations } from "@/components/dashboard/PendingConfirmations";
import TrialBanner from "@/components/billing/TrialBanner";
import NotificationWrapper from "@/components/shared/NotificationWrapper";
import DraftsBanner from "@/components/deliveries/DraftsBanner";

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
    let draftDeliveries: { id: number; address: string; customerName: string | null; createdAt: string | null }[] = [];

    const pendingConfirmations = await getPendingConfirmations(user.id);
    const isShopkeeperOrAdmin =
        !isAdminViewingAsMotoboy &&
        (user.role === "shopkeeper" || (user.role as string) === "admin");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isShopkeeperOrAdmin) {
        recentTransactions = await getRecentTransactions();

        // Corridas do PDV esperando conferência do endereço (invisíveis pro motoboy)
        const draftWhere = (user.role as string) === "admin"
            ? eq(deliveries.status, "draft")
            : and(eq(deliveries.status, "draft"), eq(deliveries.shopkeeperId, user.id));
        draftDeliveries = await db.select({
            id: deliveries.id,
            address: deliveries.address,
            customerName: deliveries.customerName,
            createdAt: deliveries.createdAt,
        })
            .from(deliveries)
            .where(draftWhere)
            .orderBy(desc(deliveries.createdAt));

        const pendingWhere = (user.role as string) === "admin"
            ? eq(deliveries.status, "pending")
            : and(eq(deliveries.status, "pending"), eq(deliveries.shopkeeperId, user.id));
        pendingDeliveries = await db.select()
            .from(deliveries)
            .where(pendingWhere)
            .orderBy(deliveries.stopOrder, desc(deliveries.createdAt));

        // Marcar endereços suspeitos (fora do raio da loja)
        const shopIds = Array.from(new Set(pendingDeliveries.map(d => d.shopkeeperId).filter((x): x is number => x != null)));
        if (shopIds.length) {
            const cfg = await db.select({
                userId: shopSettings.userId,
                shopLat: shopSettings.shopLat,
                shopLng: shopSettings.shopLng,
            }).from(shopSettings).where(inArray(shopSettings.userId, shopIds));
            const byShop = new Map(cfg.map(c => [c.userId, c]));
            pendingDeliveries = pendingDeliveries.map(d => {
                const c = d.shopkeeperId != null ? byShop.get(d.shopkeeperId) : null;
                const suspect = c
                    ? isAddressSuspicious(d.lat ?? 0, d.lng ?? 0, c.shopLat, c.shopLng, 100)
                    : false;
                return { ...d, isSuspectAddress: suspect };
            });
        }
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

        // Aplicar config de visibilidade do lojista (NO SERVIDOR — cliente nunca recebe campo oculto)
        const shopIds = Array.from(new Set(pendingDeliveries.map(d => d.shopkeeperId).filter((x): x is number => x != null)));
        const visibilityByShop = new Map<number, VisibilityFlags>();
        if (shopIds.length) {
            const settings = await db.select({
                userId: shopSettings.userId,
                showCustomerName: shopSettings.showCustomerName,
                showCustomerPhone: shopSettings.showCustomerPhone,
                showOrderValue: shopSettings.showOrderValue,
                showObservation: shopSettings.showObservation,
            }).from(shopSettings).where(inArray(shopSettings.userId, shopIds));
            for (const s of settings) {
                visibilityByShop.set(s.userId, {
                    showCustomerName: s.showCustomerName ?? true,
                    showCustomerPhone: s.showCustomerPhone ?? true,
                    showOrderValue: s.showOrderValue ?? false,
                    showObservation: s.showObservation ?? true,
                });
            }
        }
        pendingDeliveries = applyVisibility(pendingDeliveries, visibilityByShop);
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
                <DraftsBanner drafts={draftDeliveries} />

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
