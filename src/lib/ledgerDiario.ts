import { db } from "@/db";
import { deliveries, transactions, users } from "@/db/schema";
import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { type DiaDoLedger } from "./ledgerDiario-shared";

export * from "./ledgerDiario-shared";

/**
 * O controle diário da carteira: o extrato somado por DIA.
 *
 * A carteira (src/lib/wallet.ts) continua sendo a régua única do saldo — aqui
 * ninguém inventa conta nova, só agrupa os MESMOS lançamentos confirmados por
 * dia de Brasília:
 *
 *   ganho          = Σ credit/corrida
 *   dinheiroComEle = Σ debit/dinheiro   (dinheiro do cliente que ficou com ele)
 *   devolveu       = Σ credit/pagamento (ele entregou pra loja)
 *   lojaPagou      = Σ debit/pagamento  (a loja pagou ele)
 *   ajustes        = ajuste + saldo inicial, com sinal
 *
 * O dia é o dia de BRASÍLIA, pela mesma conta do resto do projeto
 * (`datetime(created_at, '-3 hours')` — UTC−3 fixo, sem horário de verão).
 *
 * Só entra `status = 'confirmed'`: lançamento esperando o motoboy aceitar ainda
 * não é dinheiro.
 */

const CONFIRMADO = eq(transactions.status, "confirmed");

/** O dia de Brasília do lançamento, "YYYY-MM-DD". */
const DIA_BRT = sql<string>`date(datetime(${transactions.createdAt}, '-3 hours'))`;

/** saldo = Σ credit − Σ debit, igualzinho ao BALANCE_EXPR da carteira. */
const SALDO = sql<number>`
    COALESCE(SUM(CASE WHEN ${transactions.type} = 'credit' THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)`;

function soma(kind: string, type: "credit" | "debit"): SQL<number> {
    return sql<number>`COALESCE(SUM(CASE WHEN ${transactions.kind} = ${kind} AND ${transactions.type} = ${type} THEN ${transactions.amount} ELSE 0 END), 0)`;
}

export type OpcoesDoLedger = {
    /**
     * Restringe as corridas e o dinheiro do cliente às entregas DAQUELA loja.
     * Lançamento manual (pagamento, ajuste, saldo inicial) não tem loja e entra
     * sempre. Sem isto (o padrão), o ledger é a carteira inteira do motoboy — é
     * assim que as telas usam, pra o saldo bater com o extrato.
     */
    shopkeeperId?: number | null;
};

export type LedgerPorDia = {
    deDia: string;
    ateDia: string;
    /** Saldo com tudo que foi confirmado ANTES de `deDia`. */
    saldoInicial: number;
    /** Saldo no fim de `ateDia` (= saldoInicial + as variações dos dias). */
    saldoFinal: number;
    /** Saldo de hoje, sem recorte de data — o número do cabeçalho. */
    saldoAtual: number;
    /** Só os dias COM movimento, do mais antigo pro mais novo. */
    dias: DiaDoLedger[];
};

/** Soma centavo a centavo sem herdar o lixo de ponto flutuante. */
function arredonda(n: number): number {
    return Math.round(n * 100) / 100;
}

/** As condições comuns: motoboy, confirmado e (se pedido) a loja das corridas. */
function escopo(userId: number, opcoes: OpcoesDoLedger): (SQL | undefined)[] {
    const shopkeeperId = opcoes.shopkeeperId;
    return [
        eq(transactions.userId, userId),
        CONFIRMADO,
        shopkeeperId == null
            ? undefined
            : or(isNull(transactions.relatedDeliveryId), eq(deliveries.shopkeeperId, shopkeeperId)),
    ];
}

/**
 * Dia a dia entre `deDia` e `ateDia` (os dois incluídos), com o saldo correndo.
 */
export async function getLedgerPorDia(
    userId: number,
    deDia: string,
    ateDia: string,
    opcoes: OpcoesDoLedger = {},
): Promise<LedgerPorDia> {
    const comum = escopo(userId, opcoes);

    const [aberturaRow, atualRow, linhas] = await Promise.all([
        db.select({ saldo: SALDO })
            .from(transactions)
            .leftJoin(deliveries, eq(transactions.relatedDeliveryId, deliveries.id))
            .where(and(...comum, sql`${DIA_BRT} < ${deDia}`))
            .get(),
        db.select({ saldo: SALDO })
            .from(transactions)
            .leftJoin(deliveries, eq(transactions.relatedDeliveryId, deliveries.id))
            .where(and(...comum))
            .get(),
        db.select({
            dia: DIA_BRT,
            corridas: sql<number>`COUNT(CASE WHEN ${transactions.kind} = 'corrida' AND ${transactions.type} = 'credit' THEN 1 END)`,
            ganho: soma("corrida", "credit"),
            dinheiroComEle: soma("dinheiro", "debit"),
            devolveu: soma("pagamento", "credit"),
            lojaPagou: soma("pagamento", "debit"),
            // Ajuste e saldo inicial andam juntos: os dois são "a loja e o motoboy
            // combinaram um número", e separá-los na tela só confundiria.
            ajustes: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.kind} IN ('ajuste', 'abertura')
                THEN (CASE WHEN ${transactions.type} = 'credit' THEN ${transactions.amount} ELSE -${transactions.amount} END)
                ELSE 0 END), 0)`,
            variacao: SALDO,
        })
            .from(transactions)
            .leftJoin(deliveries, eq(transactions.relatedDeliveryId, deliveries.id))
            .where(and(...comum, sql`${DIA_BRT} >= ${deDia}`, sql`${DIA_BRT} <= ${ateDia}`))
            .groupBy(DIA_BRT)
            .orderBy(DIA_BRT),
    ]);

    const saldoInicial = arredonda(Number(aberturaRow?.saldo ?? 0));
    let saldo = saldoInicial;

    const dias: DiaDoLedger[] = linhas.map((l) => {
        const variacao = arredonda(Number(l.variacao ?? 0));
        saldo = arredonda(saldo + variacao);
        return {
            dia: String(l.dia),
            corridas: Number(l.corridas ?? 0),
            ganho: arredonda(Number(l.ganho ?? 0)),
            dinheiroComEle: arredonda(Number(l.dinheiroComEle ?? 0)),
            devolveu: arredonda(Number(l.devolveu ?? 0)),
            lojaPagou: arredonda(Number(l.lojaPagou ?? 0)),
            ajustes: arredonda(Number(l.ajustes ?? 0)),
            variacao,
            saldoNoFim: saldo,
        };
    });

    return {
        deDia,
        ateDia,
        saldoInicial,
        saldoFinal: saldo,
        saldoAtual: arredonda(Number(atualRow?.saldo ?? 0)),
        dias,
    };
}

/** Um "ele me entregou dinheiro" do período, do jeito que aparece na lista. */
export type LinhaDeDevolucao = {
    id: number;
    amount: number;
    description: string | null;
    createdAt: string;
    creatorName: string | null;
};

/**
 * As devoluções (credit/pagamento) do período, da mais nova pra mais velha.
 * É o bloco "Devoluções" da tela de Controle — o "onde foi parar os R$ 140".
 *
 * Não tem recorte de loja: devolução é lançamento manual na carteira, e
 * carteira não tem loja (quem tem é a corrida).
 */
export async function getDevolucoesNoPeriodo(
    userId: number,
    deDia: string,
    ateDia: string,
): Promise<LinhaDeDevolucao[]> {
    const linhas = await db
        .select({
            id: transactions.id,
            amount: transactions.amount,
            description: transactions.description,
            createdAt: transactions.createdAt,
            creatorName: users.name,
        })
        .from(transactions)
        .leftJoin(users, eq(transactions.creatorId, users.id))
        .where(and(
            eq(transactions.userId, userId),
            CONFIRMADO,
            eq(transactions.kind, "pagamento"),
            eq(transactions.type, "credit"),
            sql`${DIA_BRT} >= ${deDia}`,
            sql`${DIA_BRT} <= ${ateDia}`,
        ))
        .orderBy(sql`${transactions.createdAt} DESC`, sql`${transactions.id} DESC`);

    return linhas.map((l) => ({
        id: l.id,
        amount: Number(l.amount ?? 0),
        description: l.description,
        createdAt: l.createdAt ?? "",
        creatorName: l.creatorName,
    }));
}
