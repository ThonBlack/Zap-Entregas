// Título da aba: sem isso toda tela do app se chama "Zap Entregas".
export const metadata = { title: "Fechamento do dia · Zap Entregas" };

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, User, Wallet } from "lucide-react";

import { requireShopkeeper } from "@/lib/session";
import { carregarMotoboyGerenciado } from "@/lib/team";
import { getDailySummary } from "@/lib/dailySummary";
import { getClosing } from "@/lib/dailyClosing";
import { ehDiaISO, fmtDiaLegivel, hojeBrasiliaISO, somaDiasISO } from "@/lib/datetime";
import ResumoDoDia from "@/components/finance/ResumoDoDia";

/**
 * "Resumo do dia" da loja: confere as corridas do motoboy num dia, corrige o que
 * estiver errado e manda ele confirmar. É a tela do fechamento de caixa diário.
 */
export default async function FechamentoPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ d?: string }>;
}) {
    const me = await requireShopkeeper();
    const { id } = await params;

    // Dinheiro: lojista só abre o fechamento do motoboy da própria loja.
    const motoboy = await carregarMotoboyGerenciado(me, Number(id));
    if (!motoboy) notFound();

    const hoje = hojeBrasiliaISO();
    const pedido = (await searchParams).d;
    const day = ehDiaISO(pedido) ? pedido : hoje;

    const [summary, closing] = await Promise.all([
        getDailySummary(motoboy.id, motoboy.shopkeeperId ?? null, day),
        getClosing(motoboy.id, day),
    ]);

    const basePath = `/motoboys/${motoboy.id}/fechamento`;
    const ontem = somaDiasISO(day, -1);
    const amanha = somaDiasISO(day, 1);
    const temProximo = amanha <= hoje;

    return (
        <div className="min-h-screen bg-zinc-900 pb-24">
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10 px-4 py-4 flex items-center gap-3 shadow-md">
                <Link href={`/motoboys/${motoboy.id}/financeiro`} className="text-zinc-400 hover:text-green-400 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                {motoboy.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={motoboy.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-zinc-600" />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400"><User size={18} /></div>
                )}
                <div className="min-w-0 flex-1">
                    <h1 className="text-lg font-bold text-white truncate">Resumo do dia</h1>
                    <p className="text-xs text-zinc-400 truncate">{motoboy.name}</p>
                </div>
                <Link
                    href={`/motoboys/${motoboy.id}/financeiro`}
                    className="p-2 text-zinc-400 hover:text-green-400 bg-zinc-700 rounded-lg hover:bg-zinc-600"
                    title="Carteira do motoboy"
                >
                    <Wallet size={20} />
                </Link>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-4">
                {/* Navegação de dia — o futuro não tem corrida, então não tem pra onde ir */}
                <div className="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2">
                    <Link
                        href={`${basePath}?d=${ontem}`}
                        className="min-h-11 min-w-11 flex items-center justify-center text-zinc-300 hover:text-white"
                        aria-label="Dia anterior"
                    >
                        <ChevronLeft size={20} />
                    </Link>
                    <span className="font-bold text-white text-sm text-center px-2">
                        {day === hoje ? "Hoje" : fmtDiaLegivel(day)}
                        {day === hoje && <span className="block text-xs font-normal text-zinc-400">{fmtDiaLegivel(day)}</span>}
                    </span>
                    {temProximo ? (
                        <Link
                            href={`${basePath}?d=${amanha}`}
                            className="min-h-11 min-w-11 flex items-center justify-center text-zinc-300 hover:text-white"
                            aria-label="Próximo dia"
                        >
                            <ChevronRight size={20} />
                        </Link>
                    ) : (
                        <span className="min-h-11 min-w-11 flex items-center justify-center text-zinc-700" aria-hidden="true">
                            <ChevronRight size={20} />
                        </span>
                    )}
                </div>

                <ResumoDoDia
                    motoboyId={motoboy.id}
                    motoboyName={motoboy.name}
                    summary={summary}
                    closing={closing && {
                        id: closing.id,
                        status: closing.status,
                        note: closing.note,
                        motoboyNote: closing.motoboyNote,
                        sentAt: closing.sentAt,
                        respondedAt: closing.respondedAt,
                    }}
                    podeEditar
                />
            </main>
        </div>
    );
}
