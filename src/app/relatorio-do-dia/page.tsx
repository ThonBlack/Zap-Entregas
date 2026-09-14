// Título da aba: sem isso toda tela do app se chama "Zap Entregas".
export const metadata = { title: "Relatório do dia · Zap Entregas" };

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, ClipboardCheck, User, Users } from "lucide-react";

import { db } from "@/db";
import { users } from "@/db/schema";
import { asc } from "drizzle-orm";
import { requireShopkeeper } from "@/lib/session";
import { ehAdmin, motoboyScope } from "@/lib/team";
import { getMotoboysComCorridasNoDia } from "@/lib/dailySummary";
import { getClosingsForDay } from "@/lib/dailyClosing";
import { CLOSING_STATUS_LABEL } from "@/lib/dailyClosing-shared";
import { ehDiaISO, fmtDiaLegivel, hojeBrasiliaISO } from "@/lib/datetime";

/**
 * Atalho "Relatório do dia" do botão do painel.
 *
 * O resumo de verdade mora em /motoboys/[id]/fechamento — e ele precisa saber
 * DE QUEM é o dia. Esta tela só resolve essa escolha: com um motoboy só, manda
 * direto pro resumo de hoje; com vários, mostra a lista pra loja tocar no nome.
 * Nada do fechamento é recalculado aqui.
 */
export default async function RelatorioDoDiaPage({
    searchParams,
}: {
    searchParams: Promise<{ d?: string }>;
}) {
    const me = await requireShopkeeper();

    // O dia vem do mesmo lugar que o resto do fechamento usa (fuso de Brasília).
    const hoje = hojeBrasiliaISO();
    const pedido = (await searchParams).d;
    const day = ehDiaISO(pedido) ? pedido : hoje;

    // Lojista só enxerga a equipe dele; admin enxerga todo mundo.
    const equipe = await db
        .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(motoboyScope(me))
        .orderBy(asc(users.name));

    // Motoboy sozinho não tem o que escolher: vai direto pro resumo dele.
    if (equipe.length === 1) {
        redirect(`/motoboys/${equipe[0].id}/fechamento?d=${day}`);
    }

    const ids = equipe.map((m) => m.id);
    const [comCorridas, fechamentos] = await Promise.all([
        getMotoboysComCorridasNoDia(ehAdmin(me) ? null : me.id, day),
        getClosingsForDay(ids, day),
    ]);
    const corridasPor = new Map(comCorridas.map((c) => [c.motoboyId, c.corridas]));

    // Quem rodou no dia aparece primeiro — é quem a loja veio acertar.
    const lista = [...equipe].sort((a, b) => {
        const diff = (corridasPor.get(b.id) ?? 0) - (corridasPor.get(a.id) ?? 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name, "pt-BR");
    });

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10 px-4 py-4 flex items-center gap-3 shadow-md">
                <Link href="/app" className="text-zinc-400 hover:text-green-400 transition-colors" aria-label="Voltar ao painel">
                    <ArrowLeft size={24} />
                </Link>
                <div className="flex items-center gap-2 min-w-0">
                    <ClipboardCheck size={20} className="text-green-400 shrink-0" />
                    <div className="min-w-0">
                        <h1 className="text-lg font-bold text-white truncate">Relatório do dia</h1>
                        <p className="text-xs text-zinc-400 truncate">
                            {day === hoje ? "Hoje" : fmtDiaLegivel(day)}
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-4">
                {lista.length === 0 ? (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 text-center space-y-3">
                        <Users size={28} className="text-zinc-500 mx-auto" />
                        <p className="text-zinc-400 text-sm">
                            Nenhum motoboy na equipe ainda. Cadastre um pra fechar o dia com ele.
                        </p>
                        <Link
                            href="/motoboys"
                            className="inline-flex items-center justify-center min-h-11 px-4 rounded-lg bg-green-600 text-white font-bold hover:bg-green-500 transition-colors"
                        >
                            Cadastrar motoboy
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-zinc-400">
                            Escolha de quem você quer ver o relatório {day === hoje ? "de hoje" : `de ${fmtDiaLegivel(day)}`}.
                        </p>
                        <ul className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden divide-y divide-zinc-700">
                            {lista.map((m) => {
                                const corridas = corridasPor.get(m.id) ?? 0;
                                const fechamento = fechamentos.get(m.id);
                                return (
                                    <li key={m.id}>
                                        <Link
                                            href={`/motoboys/${m.id}/fechamento?d=${day}`}
                                            className="flex items-center gap-3 px-4 py-3 min-h-14 hover:bg-zinc-700/50 transition-colors"
                                        >
                                            {m.avatarUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={m.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-zinc-600 shrink-0" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                                                    <User size={20} />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-white truncate">{m.name}</p>
                                                <p className="text-xs text-zinc-400 truncate">
                                                    {corridas === 0
                                                        ? "sem corridas no dia"
                                                        : `${corridas} ${corridas === 1 ? "corrida" : "corridas"}`}
                                                    {fechamento && fechamento.status !== "draft"
                                                        ? ` · ${CLOSING_STATUS_LABEL[fechamento.status]}`
                                                        : ""}
                                                </p>
                                            </div>
                                            <ChevronRight size={18} className="text-green-400 shrink-0" />
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </main>
        </div>
    );
}
