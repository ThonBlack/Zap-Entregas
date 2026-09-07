"use server";

import { db } from "@/db";
import { dailyClosings, deliveries, transactions, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getAuthUserWithRole } from "@/lib/session";
import { carregarMotoboyGerenciado } from "@/lib/team";
import { getDailySummary } from "@/lib/dailySummary";
import { parseMoney } from "@/lib/money";
import { pushToUser } from "@/lib/push";
import { ehDiaISO, fmtDiaCurto } from "@/lib/datetime";
import { formatBRL } from "@/lib/wallet-shared";
import { logServerError } from "@/lib/serverLog";

/**
 * Ações do "Resumo do dia" — o fechamento diário entre a loja e o motoboy.
 *
 * Duas coisas que não existiam antes:
 *   1. a loja consegue CORRIGIR o recibo de uma corrida já entregue (e a carteira
 *      acompanha a correção, em vez de ficar errada pra sempre);
 *   2. o motoboy dá o "de acordo" (ou contesta) no total do dia.
 *
 * Nenhuma delas cria lançamento novo de acerto: pagar continua sendo lançamento
 * separado, em /finance/new.
 */

const RECEIPT_STATUSES = ["recebido", "valor_diferente", "nao_recebido", "nada_a_receber"] as const;
const RECEIPT_METHODS = ["dinheiro", "pix", "cartao"] as const;

type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];
type ReceiptMethod = (typeof RECEIPT_METHODS)[number];

export type AdjustReceiptInput = {
    deliveryId: number;
    /** Taxa da corrida, como a pessoa digitou ("12,50"). */
    fee: string;
    receiptStatus: ReceiptStatus;
    /** Quanto o motoboy recebeu do cliente ("150,00"). Ignorado se não recebeu. */
    receivedAmount?: string;
    receivedMethod?: ReceiptMethod | "";
};

export type ActionResult = { success: true; closingId?: number } | { error: string };

/** O dia de Brasília (YYYY-MM-DD) em que a corrida foi entregue. */
async function diaDaCorrida(deliveryId: number): Promise<string | null> {
    const row = await db
        .select({ dia: sql<string>`date(datetime(${deliveries.deliveredAt}, '-3 hours'))` })
        .from(deliveries)
        .where(eq(deliveries.id, deliveryId))
        .get();
    return row?.dia ?? null;
}

/**
 * Corrige a taxa e o recebimento de uma corrida JÁ ENTREGUE e conserta a
 * carteira junto (crédito da corrida e débito do dinheiro em espécie).
 * Tudo numa transação só: ou muda tudo, ou não muda nada.
 */
export async function adjustDeliveryReceiptAction(input: AdjustReceiptInput): Promise<ActionResult> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return { error: auth.error };
    const me = auth.user;

    const id = Number(input?.deliveryId);
    if (!Number.isInteger(id) || id <= 0) return { error: "Corrida inválida." };

    const status = input?.receiptStatus;
    if (!RECEIPT_STATUSES.includes(status)) return { error: "Escolha o que aconteceu com o pagamento." };

    const fee = parseMoney(input?.fee ?? "0");
    if (fee == null || fee < 0 || fee > 100000) return { error: "Taxa inválida." };

    let receivedAmount = 0;
    let receivedMethod: ReceiptMethod | null = null;
    if (status === "recebido" || status === "valor_diferente") {
        const valor = parseMoney(input?.receivedAmount ?? "0");
        if (valor == null || valor < 0 || valor > 100000) return { error: "Valor recebido inválido." };
        receivedAmount = valor;
        const metodo = input?.receivedMethod;
        if (!metodo || !RECEIPT_METHODS.includes(metodo as ReceiptMethod)) {
            return { error: "Informe como o cliente pagou (dinheiro, PIX ou cartão)." };
        }
        receivedMethod = metodo as ReceiptMethod;
    }

    const delivery = await db.query.deliveries.findFirst({ where: eq(deliveries.id, id) });
    if (!delivery) return { error: "Corrida não encontrada." };
    if (delivery.status !== "delivered") return { error: "Só dá pra corrigir corrida já entregue." };
    if (me.role !== "admin" && delivery.shopkeeperId !== me.id) {
        return { error: "Esta corrida não é da sua loja." };
    }

    // Fechamento já confirmado não muda escondido: a loja precisa reabrir antes.
    const dia = await diaDaCorrida(id);
    if (dia && delivery.motoboyId) {
        const fechamento = await db.query.dailyClosings.findFirst({
            where: and(eq(dailyClosings.motoboyId, delivery.motoboyId), eq(dailyClosings.day, dia)),
        });
        if (fechamento?.status === "confirmed") {
            return { error: "O motoboy já confirmou este dia. Clique em “Reabrir” antes de editar." };
        }
    }

    const agora = new Date().toISOString();
    const motoboyId = delivery.motoboyId;

    try {
        db.transaction((tx) => {
            tx.update(deliveries)
                .set({
                    fee,
                    receiptStatus: status,
                    receivedAmount,
                    receivedMethod,
                    adjustedBy: me.id,
                    adjustedAt: agora,
                    updatedAt: agora,
                })
                .where(eq(deliveries.id, id))
                .run();

            // Sem motoboy na corrida não há carteira pra corrigir.
            if (!motoboyId) return;

            // Crédito da corrida = taxa. Casamos por (corrida, credit) e não por
            // "kind", pra alcançar também os lançamentos antigos sem kind certo.
            const credito = tx
                .select({ id: transactions.id })
                .from(transactions)
                .where(and(eq(transactions.relatedDeliveryId, id), eq(transactions.type, "credit")))
                .get();

            if (fee > 0) {
                const descricao = `Corrida #${id} - ${delivery.customerName || "Cliente"}`;
                if (credito) {
                    tx.update(transactions)
                        .set({ amount: fee, kind: "corrida", userId: motoboyId, description: descricao, status: "confirmed" })
                        .where(eq(transactions.id, credito.id))
                        .run();
                } else {
                    tx.insert(transactions)
                        .values({
                            userId: motoboyId,
                            amount: fee,
                            type: "credit",
                            kind: "corrida",
                            description: descricao,
                            relatedDeliveryId: id,
                            creatorId: me.id,
                            status: "confirmed",
                            createdAt: agora,
                        })
                        .run();
                }
            } else if (credito) {
                tx.delete(transactions).where(eq(transactions.id, credito.id)).run();
            }

            // Débito só existe quando o cliente pagou em ESPÉCIE: PIX e cartão
            // caem direto na conta da loja, não passam pela mão do motoboy.
            const debito = tx
                .select({ id: transactions.id })
                .from(transactions)
                .where(and(eq(transactions.relatedDeliveryId, id), eq(transactions.type, "debit")))
                .get();

            const dinheiro = receivedMethod === "dinheiro" ? receivedAmount : 0;
            if (dinheiro > 0) {
                const descricao = `Recebido do cliente em dinheiro - Corrida #${id}`;
                if (debito) {
                    tx.update(transactions)
                        .set({ amount: dinheiro, kind: "dinheiro", userId: motoboyId, description: descricao, status: "confirmed" })
                        .where(eq(transactions.id, debito.id))
                        .run();
                } else {
                    tx.insert(transactions)
                        .values({
                            userId: motoboyId,
                            amount: dinheiro,
                            type: "debit",
                            kind: "dinheiro",
                            description: descricao,
                            relatedDeliveryId: id,
                            creatorId: me.id,
                            status: "confirmed",
                            createdAt: agora,
                        })
                        .run();
                }
            } else if (debito) {
                tx.delete(transactions).where(eq(transactions.id, debito.id)).run();
            }
        });
    } catch (e) {
        console.error("[FECHAMENTO] erro ao corrigir recibo", e);
        await logServerError("corrigir_recibo", e, { userId: me.id, page: "/motoboys/fechamento", deliveryId: id });
        return { error: "Não deu pra salvar a correção. Tente de novo." };
    }

    if (motoboyId) {
        revalidatePath(`/motoboys/${motoboyId}/fechamento`);
        revalidatePath(`/motoboys/${motoboyId}/financeiro`);
    }
    revalidatePath("/motoboys");
    revalidatePath("/finance/extrato");
    revalidatePath("/deliveries/history");
    revalidatePath("/app");
    return { success: true };
}

/**
 * Congela os totais do dia e manda pro motoboy conferir. Reenviar depois de
 * corrigir atualiza a MESMA linha (índice único motoboy+dia) e volta pra "sent".
 */
export async function sendDailyClosingAction(
    motoboyId: number,
    day: string,
    note?: string,
): Promise<ActionResult> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return { error: auth.error };
    const me = auth.user;

    if (!ehDiaISO(day)) return { error: "Dia inválido." };

    const motoboy = await carregarMotoboyGerenciado(me, Number(motoboyId));
    if (!motoboy) return { error: "Motoboy não encontrado." };

    const existente = await db.query.dailyClosings.findFirst({
        where: and(eq(dailyClosings.motoboyId, motoboy.id), eq(dailyClosings.day, day)),
    });
    if (existente?.status === "confirmed") {
        return { error: "O motoboy já confirmou este dia. Clique em “Reabrir” antes de reenviar." };
    }

    const resumo = await getDailySummary(motoboy.id, motoboy.shopkeeperId ?? null, day);
    if (resumo.deliveriesCount === 0) {
        return { error: "Nenhuma corrida entregue neste dia — não há o que confirmar." };
    }

    const recado = typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null;
    const agora = new Date().toISOString();
    const valores = {
        deliveriesCount: resumo.deliveriesCount,
        feesTotal: resumo.feesTotal,
        cashTotal: resumo.cashTotal,
        pixTotal: resumo.pixTotal,
        cardTotal: resumo.cardTotal,
        adjustmentsTotal: resumo.adjustmentsTotal,
        net: resumo.net,
        status: "sent" as const,
        note: recado,
        // Reenvio limpa a resposta anterior: o motoboy vai responder de novo.
        motoboyNote: null,
        respondedAt: null,
        sentAt: agora,
        updatedAt: agora,
    };

    let closingId: number;
    if (existente) {
        await db.update(dailyClosings).set(valores).where(eq(dailyClosings.id, existente.id));
        closingId = existente.id;
    } else {
        const criado = await db
            .insert(dailyClosings)
            .values({
                shopkeeperId: motoboy.shopkeeperId ?? me.id,
                motoboyId: motoboy.id,
                day,
                createdBy: me.id,
                createdAt: agora,
                ...valores,
            })
            .returning({ id: dailyClosings.id })
            .get();
        closingId = criado.id;
    }

    const corridas = `${resumo.deliveriesCount} ${resumo.deliveriesCount === 1 ? "corrida" : "corridas"}`;
    pushToUser(motoboy.id, {
        title: `📋 Resumo do dia ${fmtDiaCurto(day)}`,
        body: `${corridas} · ${formatBRL(resumo.feesTotal)} de taxa. Confira e confirme.`,
        url: `/finance/extrato?fechamento=${closingId}`,
        tag: `fechamento-${closingId}`,
    }).catch(() => { });

    revalidatePath(`/motoboys/${motoboy.id}/fechamento`);
    revalidatePath("/motoboys");
    revalidatePath("/finance/extrato");
    revalidatePath("/app");
    return { success: true, closingId };
}

/** Volta o fechamento pra rascunho, liberando a edição das corridas do dia. */
export async function reopenDailyClosingAction(motoboyId: number, day: string): Promise<ActionResult> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return { error: auth.error };
    const me = auth.user;

    if (!ehDiaISO(day)) return { error: "Dia inválido." };
    const motoboy = await carregarMotoboyGerenciado(me, Number(motoboyId));
    if (!motoboy) return { error: "Motoboy não encontrado." };

    await db
        .update(dailyClosings)
        .set({ status: "draft", updatedAt: new Date().toISOString() })
        .where(and(eq(dailyClosings.motoboyId, motoboy.id), eq(dailyClosings.day, day)));

    revalidatePath(`/motoboys/${motoboy.id}/fechamento`);
    revalidatePath("/finance/extrato");
    revalidatePath("/app");
    return { success: true };
}

/** Só o motoboy dono responde, e só a partir de "enviado". */
async function responder(
    closingId: number,
    novoStatus: "confirmed" | "disputed",
    motoboyNote: string | null,
): Promise<ActionResult> {
    const auth = await getAuthUserWithRole(["motoboy", "admin"]);
    if ("error" in auth) return { error: auth.error };
    const me = auth.user;

    const id = Number(closingId);
    if (!Number.isInteger(id) || id <= 0) return { error: "Fechamento inválido." };

    const agora = new Date().toISOString();
    // O WHERE carrega a trava: dono + status "sent". Clicar duas vezes, ou
    // tentar contestar depois de confirmar, não muda nada.
    const alterado = await db
        .update(dailyClosings)
        .set({ status: novoStatus, motoboyNote, respondedAt: agora, updatedAt: agora })
        .where(
            and(
                eq(dailyClosings.id, id),
                eq(dailyClosings.motoboyId, me.id),
                eq(dailyClosings.status, "sent"),
            ),
        )
        .returning({ id: dailyClosings.id, day: dailyClosings.day, shopkeeperId: dailyClosings.shopkeeperId, net: dailyClosings.net })
        .get();

    if (!alterado) {
        return { error: "Este resumo não está mais aguardando sua resposta." };
    }

    const nome = (await db.query.users.findFirst({ where: eq(users.id, me.id), columns: { name: true } }))?.name ?? "O motoboy";
    pushToUser(alterado.shopkeeperId, {
        title: novoStatus === "confirmed" ? "✅ Resumo do dia confirmado" : "⚠️ Resumo do dia contestado",
        body: novoStatus === "confirmed"
            ? `${nome} conferiu o dia ${fmtDiaCurto(alterado.day)} e está de acordo.`
            : `${nome} contestou o dia ${fmtDiaCurto(alterado.day)}: ${motoboyNote ?? ""}`.slice(0, 180),
        url: `/motoboys/${me.id}/fechamento?d=${alterado.day}`,
        tag: `fechamento-${alterado.id}`,
    }).catch(() => { });

    revalidatePath("/finance/extrato");
    revalidatePath("/app");
    revalidatePath(`/motoboys/${me.id}/fechamento`);
    revalidatePath("/motoboys");
    return { success: true, closingId: alterado.id };
}

export async function confirmDailyClosingAction(closingId: number): Promise<ActionResult> {
    return responder(closingId, "confirmed", null);
}

export async function disputeDailyClosingAction(closingId: number, note: string): Promise<ActionResult> {
    const texto = typeof note === "string" ? note.trim() : "";
    if (texto.length < 3) return { error: "Escreva o que está errado pra loja poder corrigir." };
    return responder(closingId, "disputed", texto.slice(0, 500));
}
