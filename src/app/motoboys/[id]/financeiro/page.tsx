import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Plus, HandCoins, User } from "lucide-react";
import { requireShopkeeper } from "@/lib/session";
import { getStatement, formatBRL } from "@/lib/wallet";
import StatementView from "@/components/finance/StatementView";

function parseMonth(sp: { m?: string; y?: string }) {
    const now = new Date();
    const m = Number(sp.m), y = Number(sp.y);
    const okM = Number.isInteger(m) && m >= 1 && m <= 12;
    const okY = Number.isInteger(y) && y >= 2020 && y <= 2100;
    return { month: okM ? m : now.getMonth() + 1, year: okY ? y : now.getFullYear() };
}

export default async function MotoboyFinanceiroPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ m?: string; y?: string }>;
}) {
    await requireShopkeeper();
    const { id } = await params;
    const motoboyId = Number(id);
    if (!Number.isInteger(motoboyId)) notFound();

    const motoboy = await db.query.users.findFirst({
        where: and(eq(users.id, motoboyId), eq(users.role, "motoboy")),
        columns: { id: true, name: true, phone: true, avatarUrl: true },
    });
    if (!motoboy) notFound();

    const { month, year } = parseMonth(await searchParams);
    const statement = await getStatement(motoboy.id, month, year);
    const basePath = `/motoboys/${motoboy.id}/financeiro`;
    const saldo = statement.balance;

    // "Acertar" já abre o lançamento certo com o valor do saldo.
    const acertoHref = saldo > 0
        ? `/finance/new?motoboyId=${motoboy.id}&entry=paguei&amount=${saldo.toFixed(2)}&returnTo=${encodeURIComponent(basePath)}`
        : saldo < 0
            ? `/finance/new?motoboyId=${motoboy.id}&entry=recebi&amount=${Math.abs(saldo).toFixed(2)}&returnTo=${encodeURIComponent(basePath)}`
            : null;

    return (
        <div className="min-h-screen bg-zinc-900 pb-24">
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-md">
                <Link href="/motoboys" className="text-zinc-400 hover:text-green-400 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                {motoboy.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={motoboy.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-zinc-600" />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400"><User size={18} /></div>
                )}
                <div className="min-w-0">
                    <h1 className="text-lg font-bold text-white truncate">{motoboy.name}</h1>
                    <p className="text-xs text-zinc-400">{motoboy.phone}</p>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <Link
                        href={`/finance/new?motoboyId=${motoboy.id}&returnTo=${encodeURIComponent(basePath)}`}
                        className="flex items-center justify-center gap-2 bg-zinc-800 border-2 border-green-600 text-white p-3 rounded-2xl font-bold active:scale-[0.98] hover:bg-zinc-700"
                    >
                        <Plus size={20} className="text-green-400" /> Lançar
                    </Link>
                    {acertoHref ? (
                        <Link
                            href={acertoHref}
                            className="flex items-center justify-center gap-2 bg-green-600 text-white p-3 rounded-2xl font-bold active:scale-[0.98] hover:bg-green-500"
                        >
                            <HandCoins size={20} /> Acertar {formatBRL(Math.abs(saldo))}
                        </Link>
                    ) : (
                        <div className="flex items-center justify-center gap-2 bg-zinc-800 border border-zinc-700 text-zinc-500 p-3 rounded-2xl font-bold">
                            <HandCoins size={20} /> Nada a acertar
                        </div>
                    )}
                </div>

                <StatementView statement={statement} basePath={basePath} perspective="loja" />
            </main>
        </div>
    );
}
