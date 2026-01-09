import Link from "next/link";
import { db } from "@/db";
import { users, transactions, deliveries } from "@/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut, ShieldCheck, Settings } from "lucide-react";

import { ShopkeeperView } from "@/components/dashboard/ShopkeeperView";
import { MotoboyView } from "@/components/dashboard/MotoboyView";
import { PendingConfirmations } from "@/components/dashboard/PendingConfirmations";
import TrialBanner from "@/components/TrialBanner";
import NotificationWrapper from "@/components/NotificationWrapper";

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

    // Data fetching vars
    let motoboys: Awaited<ReturnType<typeof getMotoboysWithBalance>> = [];
    let myBalance = 0;
    let pendingDeliveries: any[] = [];
    let recentTransactions: Awaited<ReturnType<typeof getRecentTransactions>> = [];
    let pendingConfirmations: Awaited<ReturnType<typeof getPendingConfirmations>> = [];

    // Always fetch pending confirmations
    pendingConfirmations = await getPendingConfirmations(user.id);

    const isShopkeeperOrAdmin = user.role === 'shopkeeper' || user.role === 'admin';

    if (isShopkeeperOrAdmin) {
        // motoboys = await getMotoboysWithBalance(); // Unused in view currently, kept if needed later or remove? Removing for performance if unused.
        // Actually, ShopkeeperView sends to /motoboys page, doesn't list them inline anymore (it never did in the original file I saw, despite fetching logic).
        // I will keep the fetch commented out to match my finding that it was dead code, or just remove it.

        recentTransactions = await getRecentTransactions();
        pendingDeliveries = await db.select()
            .from(deliveries)
            .where(eq(deliveries.status, 'pending'))
            .orderBy(deliveries.stopOrder, desc(deliveries.createdAt));

    } else {
        myBalance = await getUserBalance(user.id);
        pendingDeliveries = await db.select()
            .from(deliveries)
            .where(eq(deliveries.status, 'pending'))
            .orderBy(deliveries.stopOrder);
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
                    {isShopkeeperOrAdmin && (
                        <Link href="/settings" className="p-2 text-zinc-400 hover:text-green-400 transition-colors" title="Configurações da Loja">
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
