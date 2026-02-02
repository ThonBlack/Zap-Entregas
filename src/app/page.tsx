import Link from "next/link";
import { db } from "@/db";
import { users, transactions, deliveries } from "@/db/schema";
import { eq, sql, desc, and, or, gte, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut, ShieldCheck, Settings } from "lucide-react";

import { ShopkeeperView } from "@/components/dashboard/ShopkeeperView";
import { MotoboyView } from "@/components/dashboard/MotoboyView";
import { PendingConfirmations } from "@/components/dashboard/PendingConfirmations";
import TrialBanner from "@/components/billing/TrialBanner";
import NotificationWrapper from "@/components/shared/NotificationWrapper";

// Data Fetching Helpers
async function getMotoboysWithBalance() {
    const result = await db
        .select({
            id: users.id,
            name: users.name,
            phone: users.phone,
            balance: sql<number>`
        COALESCE(SUM(
          CASE 
            WHEN ${transactions.status} = 'confirmed' AND ${transactions.type} = 'credit' THEN ${transactions.amount}
            WHEN ${transactions.status} = 'confirmed' AND ${transactions.type} = 'debit' THEN -${transactions.amount}
            ELSE 0
          END
        ), 0)
      `.as('balance')
        })
        .from(users)
        .leftJoin(transactions, eq(users.id, transactions.userId))
        .where(eq(users.role, 'motoboy'))
        .groupBy(users.id);

    return result;
}

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
      `
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
        creatorName: users.name
    })
        .from(transactions)
        .leftJoin(users, eq(transactions.creatorId, users.id))
        .where(
            and(
                eq(transactions.userId, userId),
                eq(transactions.status, 'pending'),
                sql`${transactions.creatorId} != ${userId}`
            )
        )
        .orderBy(desc(transactions.createdAt));

    return result as { id: number; amount: number; type: 'credit' | 'debit'; description: string; createdAt: string; creatorName: string | null }[];
}

async function getRecentTransactions() {
    const result = await db.select({
        id: transactions.id,
        amount: transactions.amount,
        type: transactions.type,
        description: transactions.description,
        createdAt: transactions.createdAt,
        userName: users.name,
        status: transactions.status
    })
        .from(transactions)
        .leftJoin(users, eq(transactions.userId, users.id))
        .orderBy(desc(transactions.createdAt))
        .limit(10);

    return result as { id: number; amount: number; type: 'credit' | 'debit'; description: string; createdAt: string; userName: string; status: string }[];
}

export default async function Dashboard() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId)),
    });

    if (!user) redirect("/login");

    // Admin vai para o painel SaaS
    if (user.role === 'admin') {
        redirect("/admin/saas");
    }

    // Data fetching vars
    let motoboys: Awaited<ReturnType<typeof getMotoboysWithBalance>> = [];
    let myBalance = 0;
    let pendingDeliveries: any[] = [];
    let myDeliveries: any[] = []; // Entregas atribuídas ao motoboy
    let deliveriesTodayCount = 0; // Contador de entregas do dia
    let recentTransactions: Awaited<ReturnType<typeof getRecentTransactions>> = [];
    let pendingConfirmations: Awaited<ReturnType<typeof getPendingConfirmations>> = [];

    // Always fetch pending confirmations
    pendingConfirmations = await getPendingConfirmations(user.id);

    const isShopkeeperOrAdmin = user.role === 'shopkeeper' || user.role === 'admin';

    // Data de hoje (meia-noite)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isShopkeeperOrAdmin) {
        recentTransactions = await getRecentTransactions();
        // Lojista vê todas as pendentes
        pendingDeliveries = await db.select()
            .from(deliveries)
            .where(eq(deliveries.status, 'pending'))
            .orderBy(deliveries.stopOrder, desc(deliveries.createdAt));

    } else {
        // MOTOBOY
        myBalance = await getUserBalance(user.id);

        // 1. Entregas disponíveis (pendentes sem motoboy) + atribuídas a ele
        pendingDeliveries = await db.select()
            .from(deliveries)
            .where(
                or(
                    eq(deliveries.status, 'pending'), // Disponíveis para aceitar
                    and(
                        eq(deliveries.motoboyId, user.id),
                        inArray(deliveries.status, ['assigned', 'picked_up']) // Minhas em andamento
                    )
                )
            )
            .orderBy(deliveries.stopOrder);

        // 2. Minhas entregas em andamento (para seção separada)
        myDeliveries = pendingDeliveries.filter(d => d.motoboyId === user.id);

        // 3. Contador de entregas finalizadas HOJE
        const todayDelivered = await db.select({ count: sql<number>`count(*)` })
            .from(deliveries)
            .where(and(
                eq(deliveries.motoboyId, user.id),
                eq(deliveries.status, 'delivered'),
                gte(deliveries.deliveredAt, today.toISOString())
            ));
        deliveriesTodayCount = todayDelivered[0]?.count || 0;
    }

    return (
        <div className="min-h-screen bg-zinc-900 pb-20 md:pb-8">
            {/* Header */}
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-md">
                <div>
                    <h1 className="text-xl font-bold text-white truncate">Olá, {user.name}</h1>
                    <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
                        {user.role === 'shopkeeper' ? 'Lojista' : user.role === 'admin' ? 'Administrador' : 'Motoboy'}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {user.role === 'shopkeeper' && (
                        <Link href="/settings" className="p-2 text-zinc-400 hover:text-green-400 transition-colors" title="Configurações da Loja">
                            <Settings size={20} />
                        </Link>
                    )}
                    {user.role === 'motoboy' && (
                        <Link href="/settings/motoboy" className="p-2 text-zinc-400 hover:text-green-400 transition-colors" title="Minhas Configurações">
                            <Settings size={20} />
                        </Link>
                    )}
                    <Link href="/security/2fa-setup" className="p-2 text-zinc-400 hover:text-green-400 transition-colors" title="Segurança / 2FA">
                        <ShieldCheck size={20} />
                    </Link>
                    <form action={async () => {
                        "use server";
                        (await cookies()).delete("user_id");
                        redirect("/login");
                    }}>
                        <button className="p-2 text-zinc-400 hover:text-red-400 transition-colors" title="Sair">
                            <LogOut size={20} />
                        </button>
                    </form>
                </div>
            </header >

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

            {/* Notification Manager */}
            <NotificationWrapper
                userId={user.id}
                userRole={user.role as "motoboy" | "shopkeeper" | "admin"}
            />
        </div >
    );
}
