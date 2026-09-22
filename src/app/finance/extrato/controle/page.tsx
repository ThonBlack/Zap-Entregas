// Título da aba: sem isso toda tela do app se chama "Zap Entregas".
export const metadata = { title: "Meu controle · Zap Entregas" };

import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";

import { requireMotoboy } from "@/lib/session";
import { parseMonth } from "@/lib/wallet-shared";
import { getDevolucoesNoPeriodo, getLedgerPorDia } from "@/lib/ledgerDiario";
import { ehVisaoDoControle, intervaloDaTela } from "@/lib/ledgerDiario-shared";
import ControleView from "@/components/finance/ControleView";

/**
 * O mesmo Controle, do lado do motoboy: só leitura e só a carteira DELE
 * (`requireMotoboy` + o id da sessão; nada vem da URL). Sem botão de lançar —
 * quem lança dinheiro na carteira é a loja.
 */
export default async function MeuControlePage({
    searchParams,
}: {
    searchParams: Promise<{ v?: string; m?: string; y?: string }>;
}) {
    const user = await requireMotoboy();
    const sp = await searchParams;
    const { month, year } = parseMonth(sp);
    const visao = ehVisaoDoControle(sp.v) ? sp.v : "dia";
    const { deDia, ateDia } = intervaloDaTela(visao, month, year);

    const [ledger, devolucoes] = await Promise.all([
        getLedgerPorDia(user.id, deDia, ateDia),
        getDevolucoesNoPeriodo(user.id, deDia, ateDia),
    ]);

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-md">
                <Link href="/finance/extrato" className="text-zinc-400 hover:text-green-400 transition-colors" aria-label="Voltar pro extrato">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-bold text-white flex-1">Meu controle</h1>
                <Link href="/finance/extrato" className="text-zinc-400 hover:text-green-400" title="Extrato lançamento a lançamento">
                    <Receipt size={22} />
                </Link>
            </header>

            <main className="max-w-2xl mx-auto p-4">
                <ControleView
                    ledger={ledger}
                    devolucoes={devolucoes}
                    visao={visao}
                    month={month}
                    year={year}
                    basePath="/finance/extrato/controle"
                    perspective="motoboy"
                />
            </main>
        </div>
    );
}
