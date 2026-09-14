import { db } from "@/db";
import { deliveries, transactions } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Fechamento de uma corrida no banco: marca "entregue" e lança o dinheiro.
 *
 * Mora aqui, fora da server action, por dois motivos:
 *  - a leitura, o UPDATE do status e os dois lançamentos precisam acontecer
 *    numa transação SÓ (`db.transaction` do better-sqlite3, que é síncrona);
 *  - assim dá pra testar a regra do dinheiro sem subir o servidor.
 *
 * Antes era ler-e-depois-escrever com `await` no meio: duas finalizações ao
 * mesmo tempo (o motoboy toca em "Confirmar", a rede engasga e ele toca de
 * novo em outro aparelho) liam "ainda não tem crédito" e as duas inseriam —
 * a loja passava a dever o dobro. Agora a janela está fechada por dentro
 * (transação) e por fora (índice único `(related_delivery_id, type)`, criado em
 * scripts/utils/add_transactions_unique_delivery_index.js).
 */

export type StatusAberto = "pending" | "assigned" | "picked_up";

export type ReciboDaEntrega = {
    receiptStatus: "recebido" | "valor_diferente" | "nao_recebido" | "nada_a_receber" | null;
    receivedAmount: number | null;
    receivedMethod: "dinheiro" | "pix" | "cartao" | null;
    receiptNote: string | null;
};

export type EntradaDoFechamento = {
    deliveryId: number;
    motoboyId: number | null;
    shopkeeperId: number | null;
    customerName: string | null;
    /** Quanto o motoboy ganha pela corrida (já calculado pela regra da loja). */
    fee: number;
    recibo: ReciboDaEntrega;
    /** De quais status a corrida pode sair (varia por papel de quem clicou). */
    statusAbertos: StatusAberto[];
    /**
     * A loja finalizou uma corrida que ninguém tinha aceitado e escolheu o
     * motoboy na hora: além de lançar na carteira dele, a corrida passa a ser
     * dele no banco. Sem isto a entrega ficava órfã no histórico e o resumo do
     * dia (que filtra por motoboy_id) não achava a corrida que já tinha gerado
     * crédito e débito.
     */
    atribuirMotoboyId?: number | null;
};

export type ResultadoDoFechamento =
    | { ok: true; jaEntregue: true }
    | { ok: true; jaEntregue: false; creditoLancado: boolean; debitoLancado: boolean }
    | { ok: false; erro: string };

/** O banco barrou porque esse lançamento já existe pra essa corrida? */
export function ehLancamentoRepetido(e: unknown): boolean {
    const msg = String((e as { message?: string })?.message ?? e ?? "");
    const code = String((e as { code?: string })?.code ?? "");
    return code.includes("SQLITE_CONSTRAINT") || /UNIQUE constraint failed/i.test(msg);
}

/**
 * Marca a corrida como entregue e lança crédito (taxa) e débito (dinheiro que
 * ficou na mão do motoboy) — tudo de uma vez, ou nada.
 *
 * Repetir a chamada é seguro: a corrida já entregue devolve `jaEntregue` e
 * nenhum lançamento novo é criado.
 */
export function fecharCorridaNoBanco(entrada: EntradaDoFechamento): ResultadoDoFechamento {
    const {
        deliveryId: id, shopkeeperId, customerName, fee, recibo, statusAbertos, atribuirMotoboyId,
    } = entrada;
    const agora = new Date().toISOString();
    // Quem vai receber crédito/débito: o motoboy escolhido pela loja na hora de
    // finalizar tem prioridade sobre o que estava (ou não estava) na corrida.
    const motoboyId = atribuirMotoboyId ?? entrada.motoboyId;

    return db.transaction((tx): ResultadoDoFechamento => {
        const atual = tx
            .select({ status: deliveries.status })
            .from(deliveries)
            .where(eq(deliveries.id, id))
            .get();

        if (!atual) return { ok: false, erro: "Entrega não encontrada." };
        if (atual.status === "delivered") return { ok: true, jaEntregue: true };

        const mudou = tx
            .update(deliveries)
            .set({
                status: "delivered",
                fee,
                // Só mexe no dono quando a loja escolheu alguém — `undefined` não
                // entra no UPDATE do Drizzle, então a corrida do motoboy fica como está.
                ...(atribuirMotoboyId != null ? { motoboyId: atribuirMotoboyId } : {}),
                receiptStatus: recibo.receiptStatus,
                receivedAmount: recibo.receivedAmount,
                receivedMethod: recibo.receivedMethod,
                receiptNote: recibo.receiptNote,
                deliveredAt: agora,
                updatedAt: agora,
            })
            .where(and(eq(deliveries.id, id), inArray(deliveries.status, statusAbertos)))
            .returning({ id: deliveries.id })
            .all();

        // Alguém finalizou/cancelou entre a leitura e agora.
        if (!mudou.length) return { ok: false, erro: "Essa corrida mudou de situação. Atualize a tela." };

        let creditoLancado = false;
        let debitoLancado = false;

        // Sem motoboy na corrida não há carteira pra mexer.
        if (motoboyId) {
            // Crédito da corrida: o que a loja passa a dever ao motoboy.
            if (fee > 0) {
                creditoLancado = lancar(tx, {
                    userId: motoboyId,
                    amount: fee,
                    type: "credit",
                    kind: "corrida",
                    description: `Corrida #${id} - ${customerName || "Cliente"}`,
                    relatedDeliveryId: id,
                    creatorId: shopkeeperId,
                    createdAt: agora,
                });
            }

            // Dinheiro em espécie fica com o motoboy → débito na carteira dele.
            // PIX e cartão vão direto pra loja, não geram débito.
            const dinheiro =
                recibo.receivedMethod === "dinheiro" && recibo.receivedAmount && recibo.receivedAmount > 0
                    ? recibo.receivedAmount
                    : 0;
            if (dinheiro > 0) {
                debitoLancado = lancar(tx, {
                    userId: motoboyId,
                    amount: dinheiro,
                    type: "debit",
                    kind: "dinheiro",
                    description: `Recebido do cliente em dinheiro - Corrida #${id}`,
                    relatedDeliveryId: id,
                    creatorId: shopkeeperId,
                    createdAt: agora,
                });
            }
        }

        return { ok: true, jaEntregue: false, creditoLancado, debitoLancado };
    });
}

type LancamentoNovo = {
    userId: number;
    amount: number;
    type: "credit" | "debit";
    kind: "corrida" | "dinheiro";
    description: string;
    relatedDeliveryId: number;
    creatorId: number | null;
    createdAt: string;
};

/**
 * Insere o lançamento. Devolve `false` — sem estourar — quando o índice único
 * diz que essa corrida já tem esse lançamento ("já lançado", não é erro).
 */
function lancar(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], valores: LancamentoNovo): boolean {
    try {
        tx.insert(transactions).values({ ...valores, status: "confirmed" }).run();
        return true;
    } catch (e) {
        if (ehLancamentoRepetido(e)) return false;
        throw e;
    }
}
