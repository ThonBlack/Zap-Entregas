import Link from "next/link";
import { db } from "@/db";
import { deliveries, users } from "@/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Bike, CheckCircle2, ClipboardCheck, Clock, Pencil, Plus } from "lucide-react";
import AutoRefresh from "@/components/shared/AutoRefresh";
import FilaExpirada from "@/components/fila/FilaExpirada";
import BotaoCancelarDaFila from "@/components/fila/BotaoCancelarDaFila";
import { carregarSessaoValida } from "@/lib/queueSession";
import {
    COLUNAS_DA_FILA,
    STATUS_ABERTOS_DA_FILA,
    STATUS_FILA_LABEL,
    podeCancelarNaFila,
    podeEditarNaFila,
} from "@/lib/fila-shared";
import { rotuloCorrida } from "@/lib/dailySeq-shared";
import { chargeModeDaCorrida, rotuloCobranca } from "@/lib/chargeMode";
import { fmtShortDateTime, fmtTime } from "@/lib/datetime";

export const metadata = { title: "Fila da loja · Zap Entregas" };

// Nada de cache: a fila é o que está acontecendo AGORA no balcão, e a página é
// aberta com um código diferente por sessão.
export const dynamic = "force-dynamic";

/** O dia de hoje em Brasília, do jeito que o resto do app calcula (UTC−3). */
const HOJE_BRT = sql`date('now', '-3 hours')`;

/** Como a corrida é chamada na tela: "Corrida 7", ou "#135" quando não tem número. */
function comoChamar(id: number, dailySeq: number | null): string {
    return rotuloCorrida(dailySeq) ?? `#${id}`;
}

/**
 * A "Fila da loja" — a tela que o VENDEDOR abre dentro do painel do EpicStore.
 *
 * Por que ela existe: a venda sai do PDV e vira um rascunho aqui, que precisa
 * ser conferido (endereço no mapa, quanto cobrar) antes de ir pros motoboys.
 * Até agora isso só dava pra fazer na janelinha que abre junto com a venda — se
 * o caixa fechasse, só o dono conseguia mexer, porque o vendedor não tem login
 * no Zap.
 *
 * Quem autoriza é o código da URL, que vale 12 horas e é ligado a UMA loja
 * (src/lib/queueSession.ts). TUDO nesta tela é filtrado pelo `shopkeeperId` que
 * vem dele — nunca por um número que o navegador mandou.
 *
 * O que esta tela NÃO faz, de propósito: marcar entrega como feita, escolher ou
 * trocar motoboy, mostrar taxa/carteira/fechamento, abrir Configurações. Isso é
 * da loja e do motoboy, não de quem está atendendo no balcão.
 */
export default async function FilaDaLojaPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const sessao = await carregarSessaoValida(token);

    // Código vencido ou inventado: a tela avisa o EpicStore e ele pede outro.
    // Nunca 500 e nunca "página não encontrada" — quem está vendo é o vendedor.
    if (!sessao) return <FilaExpirada />;

    const daLoja = eq(deliveries.shopkeeperId, sessao.shopkeeperId);

    // Os três blocos numa tacada só: é uma tela que se atualiza a cada 20s.
    const [rascunhos, abertas, entreguesHoje] = await Promise.all([
        // Pra conferir: os mais antigos primeiro — quem esperou mais sai antes.
        db.query.deliveries.findMany({
            where: and(daLoja, eq(deliveries.status, "draft")),
            columns: COLUNAS_DA_FILA,
            orderBy: asc(deliveries.createdAt),
            limit: 50,
        }),
        // Na fila / em andamento: as abertas de QUALQUER dia. Corrida de ontem
        // que ninguém fechou não pode sumir da vista.
        db.query.deliveries.findMany({
            where: and(daLoja, inArray(deliveries.status, [...STATUS_ABERTOS_DA_FILA])),
            columns: COLUNAS_DA_FILA,
            with: { motoboy: { columns: { name: true } } },
            orderBy: asc(deliveries.createdAt),
            limit: 100,
        }),
        // Entregues hoje: lista curta, só pra saber o que já saiu. Sem valor,
        // sem taxa, sem recibo — só o número, quem recebeu e a hora.
        db
            .select({
                id: deliveries.id,
                dailySeq: deliveries.dailySeq,
                customerName: deliveries.customerName,
                deliveredAt: deliveries.deliveredAt,
            })
            .from(deliveries)
            .where(and(
                daLoja,
                eq(deliveries.status, "delivered"),
                sql`datetime(${deliveries.deliveredAt}, '-3 hours') >= ${HOJE_BRT}`,
            ))
            .orderBy(desc(deliveries.deliveredAt))
            .limit(30),
    ]);

    const nomeDaLoja = await db.query.users.findFirst({
        where: eq(users.id, sessao.shopkeeperId),
        columns: { name: true },
    });

    const base = `/fila/${token}`;

    return (
        <div className="min-h-screen bg-zinc-900 text-white">
            {/* A tela fica aberta o expediente todo num canto do painel: sem isto
                ela congelaria e o vendedor veria uma fila de uma hora atrás. */}
            <AutoRefresh segundos={20} />

            <header className="border-b border-zinc-800 bg-zinc-900 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <Bike size={18} className="text-green-400 shrink-0" />
                        <div className="min-w-0">
                            <h1 className="font-bold leading-tight truncate text-white">Fila da loja</h1>
                            <p className="text-xs text-zinc-400 truncate">
                                {nomeDaLoja?.name ?? "Sua loja"}
                                {sessao.operatorName ? ` · ${sessao.operatorName}` : ""}
                            </p>
                        </div>
                    </div>
                    <Link
                        href={`${base}/nova`}
                        className="flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors"
                    >
                        <Plus size={18} /> Lançar corrida
                    </Link>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-4 space-y-8">
                {/* ── Pra conferir ─────────────────────────────────────────── */}
                <section>
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-yellow-300 mb-3">
                        <ClipboardCheck size={16} />
                        Pra conferir
                        {rascunhos.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 rounded-full bg-yellow-500 text-yellow-950 text-xs font-bold">
                                {rascunhos.length}
                            </span>
                        )}
                    </h2>

                    {rascunhos.length === 0 ? (
                        <p className="text-sm text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3">
                            Nenhuma venda esperando. Quando sair um pedido pra entrega, ele aparece aqui.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {rascunhos.map((r) => (
                                <li
                                    key={r.id}
                                    className="rounded-xl bg-zinc-800 border border-yellow-600/40 p-4 space-y-3"
                                >
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-white break-words">
                                            {r.customerName || "Cliente não informado"}
                                        </p>
                                        <p className="text-sm text-zinc-300 break-words">{r.address}</p>
                                        <p className="text-xs text-zinc-400">
                                            Chegou {fmtShortDateTime(r.createdAt)} ·{" "}
                                            {rotuloCobranca(chargeModeDaCorrida(r), r.value)}
                                        </p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Link
                                            href={`${base}/conferir/${r.id}`}
                                            className="flex-1 flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors"
                                        >
                                            <ClipboardCheck size={16} /> Conferir
                                        </Link>
                                        <BotaoCancelarDaFila
                                            deliveryId={r.id}
                                            queueToken={token}
                                            rotulo={comoChamar(r.id, r.dailySeq)}
                                            temMotoboy={false}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* ── Na fila / em andamento ───────────────────────────────── */}
                <section>
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-green-300 mb-3">
                        <Clock size={16} />
                        Na fila / em andamento
                        {abertas.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 rounded-full bg-green-600 text-white text-xs font-bold">
                                {abertas.length}
                            </span>
                        )}
                    </h2>

                    {abertas.length === 0 ? (
                        <p className="text-sm text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3">
                            Nenhuma corrida aberta agora.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {abertas.map((c) => {
                                const podeEditar = podeEditarNaFila(c);
                                const podeCancelar = podeCancelarNaFila(c);
                                return (
                                    <li
                                        key={c.id}
                                        className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 space-y-3"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <p className="text-sm font-bold text-white">
                                                {comoChamar(c.id, c.dailySeq)}
                                            </p>
                                            <span className="px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-100 text-xs font-medium">
                                                {STATUS_FILA_LABEL[c.status] ?? c.status}
                                            </span>
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-sm text-white break-words">
                                                {c.customerName || "Cliente não informado"}
                                            </p>
                                            <p className="text-sm text-zinc-300 break-words">{c.address}</p>
                                            <p className="text-xs text-zinc-400">
                                                {rotuloCobranca(chargeModeDaCorrida(c), c.value)}
                                                {c.motoboy?.name ? ` · Motoboy: ${c.motoboy.name}` : ""}
                                            </p>
                                        </div>

                                        {(podeEditar || podeCancelar) && (
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                {podeEditar && (
                                                    <Link
                                                        href={`${base}/editar/${c.id}`}
                                                        className="flex-1 flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl border border-zinc-600 bg-zinc-900 text-white font-medium hover:bg-zinc-700 transition-colors"
                                                    >
                                                        <Pencil size={16} /> Editar
                                                    </Link>
                                                )}
                                                {podeCancelar && (
                                                    <BotaoCancelarDaFila
                                                        deliveryId={c.id}
                                                        queueToken={token}
                                                        rotulo={comoChamar(c.id, c.dailySeq)}
                                                        temMotoboy={Boolean(c.motoboyId)}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                {/* ── Entregues hoje ───────────────────────────────────────── */}
                <section>
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-400 mb-3">
                        <CheckCircle2 size={16} />
                        Entregues hoje
                    </h2>

                    {entreguesHoje.length === 0 ? (
                        <p className="text-sm text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3">
                            Nada entregue ainda hoje.
                        </p>
                    ) : (
                        <ul className="rounded-xl bg-zinc-800 border border-zinc-700 divide-y divide-zinc-700">
                            {entreguesHoje.map((e) => (
                                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <span className="text-sm text-white truncate">
                                        <span className="font-semibold">{comoChamar(e.id, e.dailySeq)}</span>
                                        {e.customerName ? ` · ${e.customerName}` : ""}
                                    </span>
                                    <span className="text-xs text-zinc-400 shrink-0">{fmtTime(e.deliveredAt)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <p className="text-xs text-zinc-500 pb-6">
                    A lista se atualiza sozinha. Pagamento do motoboy, fechamento do dia e configurações
                    ficam no aplicativo do Zap Entregas.
                </p>
            </main>
        </div>
    );
}
