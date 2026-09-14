import { db } from "@/db";
import { deliveries, transactions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * Resumo do dia — a régua ÚNICA do fechamento entre loja e motoboy.
 *
 * Tudo que aparece na tela do lojista, na tela do motoboy e o que é congelado
 * na linha de `daily_closings` sai daqui. Se dois lugares contassem por conta
 * própria, o "de acordo" das partes seria em cima de números diferentes.
 *
 * O dia é o dia de BRASÍLIA. O banco grava as datas em UTC e em dois formatos
 * ("2026-08-18T17:46:09.111Z" do código novo e "2026-08-18 17:46:09" do
 * CURRENT_TIMESTAMP antigo). Quem normaliza os dois é o próprio SQLite, com
 * `datetime(coluna, '-3 hours')` — o mesmo truque que a carteira (wallet.ts)
 * já usa pra virada de mês. UTC−3 fixo: o Brasil não tem mais horário de verão.
 */

/** Uma corrida do dia, do jeito que aparece na conferência. */
export type DailySummaryLine = {
    id: number;
    /** "Corrida N" do dia (por loja). NULL em corrida antiga, sem contador. */
    dailySeq: number | null;
    deliveredAt: string | null;
    customerName: string | null;
    address: string;
    fee: number;
    receiptStatus: "recebido" | "valor_diferente" | "nao_recebido" | "nada_a_receber" | null;
    receivedAmount: number | null;
    receivedMethod: "dinheiro" | "pix" | "cartao" | null;
    /** Marcada quando a loja corrigiu o recibo depois da entrega. */
    adjustedAt: string | null;
};

export type DailySummary = {
    day: string;
    motoboyId: number;
    shopkeeperId: number | null;
    deliveriesCount: number;
    /** Σ das taxas das corridas do dia (o que a loja deve ao motoboy pelo trabalho). */
    feesTotal: number;
    /** Dinheiro em espécie que ficou na mão do motoboy. */
    cashTotal: number;
    pixTotal: number;
    cardTotal: number;
    /** Σ dos ajustes manuais lançados na carteira nesse dia (crédito + / débito −). */
    adjustmentsTotal: number;
    /** feesTotal − cashTotal. >0 a loja deve ao motoboy; <0 ele deve à loja. */
    net: number;
    lines: DailySummaryLine[];
};

/** Endereço encurtado pra caber na linha da lista (a rua já basta pra reconhecer). */
export function enderecoCurto(address: string, max = 42): string {
    const primeiro = address.split(",")[0].trim() || address.trim();
    return primeiro.length > max ? `${primeiro.slice(0, max - 1)}…` : primeiro;
}

/** Só conta como recebido de verdade o que o motoboy marcou como recebido. */
function recebeu(status: string | null): boolean {
    return status === "recebido" || status === "valor_diferente";
}

/** Soma centavo a centavo sem herdar o lixo de ponto flutuante. */
function arredonda(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * Corridas `delivered` do motoboy naquele dia de Brasília + ajustes manuais do
 * mesmo dia. `shopkeeperId` nulo (motoboy "da casa", só do admin) não filtra loja.
 */
export async function getDailySummary(
    motoboyId: number,
    shopkeeperId: number | null,
    day: string,
): Promise<DailySummary> {
    const diaDaCorrida = sql`date(datetime(${deliveries.deliveredAt}, '-3 hours'))`;

    const rows = await db
        .select({
            id: deliveries.id,
            dailySeq: deliveries.dailySeq,
            deliveredAt: deliveries.deliveredAt,
            customerName: deliveries.customerName,
            address: deliveries.address,
            fee: deliveries.fee,
            receiptStatus: deliveries.receiptStatus,
            receivedAmount: deliveries.receivedAmount,
            receivedMethod: deliveries.receivedMethod,
            adjustedAt: deliveries.adjustedAt,
        })
        .from(deliveries)
        .where(
            and(
                eq(deliveries.motoboyId, motoboyId),
                eq(deliveries.status, "delivered"),
                shopkeeperId != null ? eq(deliveries.shopkeeperId, shopkeeperId) : undefined,
                sql`${diaDaCorrida} = ${day}`,
            ),
        )
        .orderBy(deliveries.deliveredAt, deliveries.id);

    // Ajustes manuais (bônus, cobrança, prejuízo) lançados nesse mesmo dia.
    // Não entram no líquido — aparecem à parte pra ninguém achar que sumiram.
    const ajustes = await db
        .select({
            total: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'credit' THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)`,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.userId, motoboyId),
                eq(transactions.kind, "ajuste"),
                eq(transactions.status, "confirmed"),
                sql`date(datetime(${transactions.createdAt}, '-3 hours')) = ${day}`,
            ),
        )
        .get();

    let feesTotal = 0;
    let cashTotal = 0;
    let pixTotal = 0;
    let cardTotal = 0;

    const lines: DailySummaryLine[] = rows.map((r) => {
        const fee = Number(r.fee ?? 0);
        const valor = recebeu(r.receiptStatus) ? Number(r.receivedAmount ?? 0) : 0;
        feesTotal += fee;
        if (valor > 0) {
            if (r.receivedMethod === "dinheiro") cashTotal += valor;
            else if (r.receivedMethod === "pix") pixTotal += valor;
            else if (r.receivedMethod === "cartao") cardTotal += valor;
        }
        return {
            id: r.id,
            dailySeq: r.dailySeq ?? null,
            deliveredAt: r.deliveredAt,
            customerName: r.customerName,
            address: r.address,
            fee,
            receiptStatus: r.receiptStatus,
            receivedAmount: r.receivedAmount,
            receivedMethod: r.receivedMethod,
            adjustedAt: r.adjustedAt ?? null,
        };
    });

    feesTotal = arredonda(feesTotal);
    cashTotal = arredonda(cashTotal);

    return {
        day,
        motoboyId,
        shopkeeperId,
        deliveriesCount: lines.length,
        feesTotal,
        cashTotal,
        pixTotal: arredonda(pixTotal),
        cardTotal: arredonda(cardTotal),
        adjustmentsTotal: arredonda(Number(ajustes?.total ?? 0)),
        net: arredonda(feesTotal - cashTotal),
        lines,
    };
}

/**
 * Motoboys da loja que fizeram corrida nesse dia — a lista do atalho
 * "Fechar o dia" no painel do lojista.
 */
export async function getMotoboysComCorridasNoDia(
    shopkeeperId: number | null,
    day: string,
): Promise<{ motoboyId: number; corridas: number }[]> {
    const rows = await db
        .select({
            motoboyId: deliveries.motoboyId,
            corridas: sql<number>`count(*)`,
        })
        .from(deliveries)
        .where(
            and(
                eq(deliveries.status, "delivered"),
                shopkeeperId != null ? eq(deliveries.shopkeeperId, shopkeeperId) : undefined,
                sql`date(datetime(${deliveries.deliveredAt}, '-3 hours')) = ${day}`,
                sql`${deliveries.motoboyId} IS NOT NULL`,
            ),
        )
        .groupBy(deliveries.motoboyId);

    return rows
        .filter((r): r is { motoboyId: number; corridas: number } => r.motoboyId != null)
        .map((r) => ({ motoboyId: r.motoboyId, corridas: Number(r.corridas) }));
}
