// Título da aba: sem isso toda tela do app se chama "Zap Entregas".
export const metadata = { title: "Controle do motoboy · Zap Entregas" };

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Wallet } from "lucide-react";

import { requireShopkeeper } from "@/lib/session";
import { carregarMotoboyGerenciado } from "@/lib/team";
import { parseMonth } from "@/lib/wallet-shared";
import { getDevolucoesNoPeriodo, getLedgerPorDia } from "@/lib/ledgerDiario";
import { ehVisaoDoControle, faltaDevolver, intervaloDaTela } from "@/lib/ledgerDiario-shared";
import ControleView from "@/components/finance/ControleView";

/**
 * "Controle" da loja: em que dias o motoboy devolveu o dinheiro e em que dias
 * não devolveu, com o saldo dia a dia, por semana e por mês.
 *
 * O guarda é o mesmo do resto do financeiro: lojista só abre a carteira do
 * motoboy da própria loja; o admin abre todas (src/lib/team.ts).
 */
export default async function ControleDoMotoboyPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ v?: string; m?: string; y?: string }>;
}) {
    const me = await requireShopkeeper();
    const { id } = await params;

    const motoboy = await carregarMotoboyGerenciado(me, Number(id));
    if (!motoboy) notFound();

    const sp = await searchParams;
    const { month, year } = parseMonth(sp);
    const visao = ehVisaoDoControle(sp.v) ? sp.v : "dia";
    const { deDia, ateDia } = intervaloDaTela(visao, month, year);

    const [ledger, devolucoes] = await Promise.all([
        getLedgerPorDia(motoboy.id, deDia, ateDia),
        getDevolucoesNoPeriodo(motoboy.id, deDia, ateDia),
    ]);

    const basePath = `/motoboys/${motoboy.id}/financeiro/controle`;
    // Voltar pra ESTA tela, no mesmo agrupamento e no mesmo mês.
    const voltarPara = encodeURIComponent(`${basePath}?v=${visao}&m=${month}&y=${year}`);
    const lancar = (extra: string) =>
        `/finance/new?motoboyId=${motoboy.id}&entry=recebi${extra}&returnTo=${voltarPara}`;

    return (
        <div className="min-h-screen bg-zinc-900 pb-24">
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10 px-4 py-4 flex items-center gap-3 shadow-md">
                <Link
                    href={`/motoboys/${motoboy.id}/financeiro`}
                    className="text-zinc-400 hover:text-green-400 transition-colors"
                    aria-label="Voltar pra carteira"
                >
                    <ArrowLeft size={24} />
                </Link>
                {motoboy.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={motoboy.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-zinc-600" />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400"><User size={18} /></div>
                )}
                <div className="min-w-0 flex-1">
                    <h1 className="text-lg font-bold text-white truncate">Controle</h1>
                    <p className="text-xs text-zinc-400 truncate">{motoboy.name}</p>
                </div>
                <Link
                    href={`/motoboys/${motoboy.id}/financeiro`}
                    className="p-2 text-zinc-400 hover:text-green-400 bg-zinc-700 rounded-lg hover:bg-zinc-600"
                    title="Extrato da carteira"
                >
                    <Wallet size={20} />
                </Link>
            </header>

            <main className="max-w-2xl mx-auto p-4">
                <ControleView
                    ledger={ledger}
                    devolucoes={devolucoes}
                    visao={visao}
                    month={month}
                    year={year}
                    basePath={basePath}
                    perspective="loja"
                    hrefDoDia={(dia) => `/motoboys/${motoboy.id}/fechamento?d=${dia}`}
                    hrefRegistrarDevolucao={lancar("")}
                    hrefRegistrarDoDia={(dia) => {
                        const falta = faltaDevolver(dia);
                        // Sem nada pendente naquele dia, o botão só atrapalharia.
                        return falta > 0 ? lancar(`&d=${dia.dia}&amount=${falta.toFixed(2)}`) : undefined;
                    }}
                />
            </main>
        </div>
    );
}
