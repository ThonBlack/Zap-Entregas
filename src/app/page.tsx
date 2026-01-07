import Link from "next/link";
import { db } from "@/db";
import { users, transactions, deliveries } from "@/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut, Plus, Wallet, TrendingUp, TrendingDown, DollarSign, AlertCircle, ShieldCheck, Settings } from "lucide-react";
import PendingDeliveriesForm from "@/components/PendingDeliveriesForm";
import { confirmTransactionAction, rejectTransactionAction } from "@/app/actions/finance";

// Helpers modified to filter confirmed transactions for balance
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
    // pending transactions where I am the target (userId) AND I am NOT the creator
    const result = await db.select({
        id: transactions.id,
        amount: transactions.amount,
        type: transactions.type,
        description: transactions.description,
        createdAt: transactions.createdAt,
        creatorName: users.name
    })
        .from(transactions)
        .leftJoin(users, eq(transactions.creatorId, users.id)) // Join to get creator name
        .where(
            and(
                eq(transactions.userId, userId),
                eq(transactions.status, 'pending'),
                // simple check: if creatorId is not null, ensuring it's not the user (though UI prevents it, safety first)
                // SQL: creator_id != user_id
                sql`${transactions.creatorId} != ${userId}`
            )
        )
        .orderBy(desc(transactions.createdAt));

    return result;
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
        .limit(10); // increased limit

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

    // Data fetching based on role
    let motoboys: Awaited<ReturnType<typeof getMotoboysWithBalance>> = [];
    let myBalance = 0;
    let pendingDeliveries: any[] = [];
    let recentTransactions: Awaited<ReturnType<typeof getRecentTransactions>> = [];
    let pendingConfirmations: Awaited<ReturnType<typeof getPendingConfirmations>> = [];

    // Always fetch pending confirmations for the logged user
    pendingConfirmations = await getPendingConfirmations(user.id);

    if (user.role === 'shopkeeper' || user.role === 'admin') {
        motoboys = await getMotoboysWithBalance();
        recentTransactions = await getRecentTransactions();
        // Shopkeeper sees ALL pending deliveries
        pendingDeliveries = await db.select()
            .from(deliveries)
            .where(eq(deliveries.status, 'pending'))
            .orderBy(deliveries.stopOrder, desc(deliveries.createdAt));

    } else {
        myBalance = await getUserBalance(user.id);
        // Fetch pending deliveries for motoboy
        pendingDeliveries = await db.select()
            .from(deliveries)
            .where(eq(deliveries.status, 'pending'))
            .orderBy(deliveries.stopOrder);
    }

    // Generate Maps Link
    let mapUrl = "";
    if (pendingDeliveries.length > 0) {
        const validDeliveries = pendingDeliveries.filter(d => d.address);
        if (validDeliveries.length > 0) {
            const destination = validDeliveries[validDeliveries.length - 1].address;
            const waypoints = validDeliveries.slice(0, -1).map(d => d.address).join('|');
            mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}`;
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 pb-20 md:pb-8">
            {/* Header */}
            <header className="bg-white border-b border-zinc-200 sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
                <div>
                    <h1 className="text-xl font-bold text-zinc-900 truncate">Olá, {user.name}</h1>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                        {user.role === 'shopkeeper' ? 'Lojista' : user.role === 'admin' ? 'Administrador' : 'Motoboy'}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {(user.role === 'shopkeeper' || user.role === 'admin') && (
                        <Link href="/settings" className="p-2 text-zinc-400 hover:text-blue-500 transition-colors" title="Configurações da Loja">
                            <Settings size={20} />
                        </Link>
                    )}
                    <Link href="/security/2fa-setup" className="p-2 text-zinc-400 hover:text-blue-500 transition-colors" title="Segurança / 2FA">
                        <ShieldCheck size={20} />
                    </Link>
                    <form action={async () => {
                        "use server";
                        (await cookies()).delete("user_id");
                        redirect("/login");
                    }}>
                        <button className="p-2 text-zinc-400 hover:text-red-500 transition-colors" title="Sair">
                            <LogOut size={20} />
                        </button>
                    </form>
                </div>
            </header >

            <main className="max-w-4xl mx-auto p-6 space-y-6">

                {/* PENDING CONFIRMATIONS (For Both Roles) */}
                {pendingConfirmations.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-yellow-800">
                            <AlertCircle className="w-5 h-5" />
                            <h2 className="font-bold">Confirmações Pendentes</h2>
                        </div>
                        <div className="space-y-3">
                            {pendingConfirmations.map(pc => (
                                <div key={pc.id} className="bg-white p-4 rounded-xl shadow-sm border border-yellow-100 flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-zinc-900">{pc.description}</p>
                                        <p className="text-sm text-zinc-500">
                                            Lançado por: <span className="font-semibold">{pc.creatorName}</span> • {new Date(pc.createdAt || "").toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className={`font-bold ${pc.type === 'debit' ? 'text-green-600' : 'text-red-600'}`}>
                                            {pc.type === 'debit' ? '+' : '-'} {pc.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>

                                        <div className="flex gap-2">
                                            <form action={async () => {
                                                "use server";
                                                await rejectTransactionAction(pc.id);
                                            }}>
                                                <button className="px-3 py-1 bg-white border border-red-200 text-red-600 text-xs font-bold rounded hover:bg-red-50">
                                                    Rejeitar
                                                </button>
                                            </form>
                                            <form action={async () => {
                                                "use server";
                                                await confirmTransactionAction(pc.id);
                                            }}>
                                                <button className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700">
                                                    Confirmar
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* SHOPKEEPER VIEW (Admin also sees this) */}
                {(user.role === 'shopkeeper' || user.role === 'admin') && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Link href="/routes/new" className="flex items-center justify-center gap-3 w-full bg-zinc-900 text-white p-4 rounded-xl font-bold shadow-lg active:scale-[0.98] transition-transform hover:bg-zinc-800">
                                <Plus size={24} />
                                <span className="text-sm">Nova Entrega</span>
                            </Link>
                            <Link href="/finance/new" className="flex items-center justify-center gap-3 w-full bg-white text-zinc-700 border border-zinc-200 p-4 rounded-xl font-bold shadow-sm active:bg-zinc-50 transition-colors hover:border-zinc-300">
                                <Wallet size={24} className="text-zinc-400" />
                                <span className="text-sm">Pagar Motoboy</span>
                            </Link>
                            <Link href="/finance/manager" className="flex items-center justify-center gap-3 w-full bg-emerald-600 text-white p-4 rounded-xl font-bold shadow-sm active:bg-emerald-700 transition-colors hover:bg-emerald-700">
                                <DollarSign size={24} className="text-white" />
                                <span className="text-sm">Gestor Financeiro</span>
                            </Link>
                        </div>

                        <div className="flex justify-end gap-4">
                            <Link href="/deliveries/history" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
                                Histórico de Entregas
                            </Link>
                            <Link href="/motoboys" className="text-sm font-medium text-blue-600 hover:underline">
                                Gerenciar Motoboys &rarr;
                            </Link>
                        </div>

                        <section>
                            <PendingDeliveriesForm deliveries={pendingDeliveries} />
                        </section>

                        {/* Transaction History */}
                        <section>
                            <h2 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                                <DollarSign size={20} className="text-blue-600" />
                                Últimas Movimentações (Saldo Motoboys)
                            </h2>
                            <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
                                <div className="divide-y divide-zinc-100">
                                    {recentTransactions.length === 0 ? (
                                        <div className="p-8 text-center text-zinc-400">Nenhuma movimentação recente.</div>
                                    ) : (
                                        recentTransactions.map(t => (
                                            <div key={t.id} className="p-4 flex justify-between items-center hover:bg-zinc-50 transition-colors">
                                                <div>
                                                    <div className="font-medium text-zinc-900">{t.userName} ({t.type === 'credit' ? 'Pagamento' : 'Recebimento'})</div>
                                                    <div className="text-xs text-zinc-500">{t.description} • {new Date(t.createdAt).toLocaleDateString()}</div>
                                                </div>
                                                <div className={cn(
                                                    "font-mono font-bold",
                                                    t.type === 'debit' ? "text-green-600" : "text-red-600"
                                                )}>
                                                    {t.type === 'debit' ? '+' : '-'} {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {/* MOTOBOY VIEW */}
                {user.role === 'motoboy' && (
                    <div className="space-y-6">
                        {/* Balance Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 text-center">
                            <h3 className="text-zinc-500 font-medium text-sm mb-2 uppercase tracking-wide">Seu Saldo (Com Lojistas)</h3>
                            <p className="text-5xl font-bold tracking-tight text-zinc-700">
                                {myBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>

                        {/* Motoboy Actions (SaaS) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Link href="/finance/manager" className="flex items-center justify-center gap-3 w-full bg-emerald-600 text-white p-4 rounded-xl font-bold shadow-sm active:bg-emerald-700 transition-colors hover:bg-emerald-700">
                                <DollarSign size={24} className="text-white" />
                                <span className="text-sm">Meu Gestor Financeiro</span>
                            </Link>
                            <Link href="/deliveries/history" className="flex items-center justify-center gap-3 w-full bg-white border border-zinc-200 text-zinc-700 p-4 rounded-xl font-bold shadow-sm active:bg-zinc-50 transition-colors hover:border-blue-400 hover:text-blue-600">
                                <DollarSign size={24} className="text-blue-600" />
                                <span className="text-sm">Meu Histórico</span>
                            </Link>
                        </div>

                        {/* Route Generation / Pending Deliveries */}
                        <section>
                            <h3 className="font-bold text-zinc-800 mb-3">Gerar Rota</h3>
                            <PendingDeliveriesForm deliveries={pendingDeliveries} />
                        </section>
                    </div>
                )}

            </main>
        </div >
    );
}

function cn(...classes: (string | undefined)[]) {
    return classes.filter(Boolean).join(' ');
}
