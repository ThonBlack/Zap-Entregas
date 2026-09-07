// Título da aba: sem isso toda tela do app se chama "Zap Entregas".
export const metadata = { title: "Financeiro do motoboy · Zap Entregas" };

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, HandCoins, User, ClipboardCheck } from "lucide-react";
import { requireShopkeeper } from "@/lib/session";
import { carregarMotoboyGerenciado } from "@/lib/team";
import { getStatement, formatBRL } from "@/lib/wallet";
import StatementView, { type MarcadorFechamento } from "@/components/finance/StatementView";
import { getRespondedClosingsByDay } from "@/lib/dailyClosing";
import { parseMonth } from "@/lib/wallet-shared";

export default async function MotoboyFinanceiroPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ m?: string; y?: string }>;
}) {
    const me = await requireShopkeeper();
    const { id } = await params;

    // Carteira é dinheiro: lojista só abre a do motoboy da própria loja.
    const motoboy = await carregarMotoboyGerenciado(me, Number(id));
    if (!motoboy) notFound();

    const { month, year } = parseMonth(await searchParams);
    const statement = await getStatement(motoboy.id, month, year);
    const basePath = `/motoboys/${motoboy.id}/financeiro`;
    const saldo = statement.balance;

    const respondidos = await getRespondedClosingsByDay(motoboy.id);
    const fechamentos: MarcadorFechamento[] = [...respondidos.values()].map(c => ({
        day: c.day,
        net: c.net,
        status: c.status as "confirmed" | "disputed",
    }));

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
                    <p className="text-xs text-zinc-400">{motoboy.phone || "sem telefone"}</p>
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

                <Link
                    href={`/motoboys/${motoboy.id}/fechamento`}
                    className="flex items-center justify-center gap-2 bg-zinc-800 border-2 border-green-600 text-white p-3 rounded-2xl font-bold min-h-11 active:scale-[0.98] hover:bg-zinc-700"
                >
                    <ClipboardCheck size={20} className="text-green-400" /> Resumo do dia
                </Link>

                <StatementView
                    statement={statement}
                    basePath={basePath}
                    perspective="loja"
                    fechamentos={fechamentos}
                />
            </main>
        </div>
    );
}
