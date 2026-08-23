import { db } from "@/db";
import { transactions, users } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { TransactionKind } from "./wallet-shared";

export * from "./wallet-shared";

/**
 * Carteira do motoboy — única régua de saldo do projeto.
 *
 * saldo = Σ credit − Σ debit (só lançamentos confirmados), do ponto de vista do motoboy:
 *   saldo > 0 → a loja deve ao motoboy (a pagar)
 *   saldo < 0 → o motoboy deve à loja (ele segurou mais dinheiro do que ganhou)
 */

const BALANCE_EXPR = sql<number>`
    COALESCE(SUM(
        CASE
            WHEN ${transactions.status} = 'confirmed' AND ${transactions.type} = 'credit' THEN ${transactions.amount}
            WHEN ${transactions.status} = 'confirmed' AND ${transactions.type} = 'debit' THEN -${transactions.amount}
            ELSE 0
        END
    ), 0)`;

export async function getBalance(userId: number): Promise<number> {
    const row = await db
        .select({ balance: BALANCE_EXPR })
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .get();
    return Number(row?.balance ?? 0);
}

/** Saldo de vários motoboys de uma vez (lista da equipe). */
export async function getBalances(userIds: number[]): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (userIds.length === 0) return map;
    const rows = await db
        .select({ userId: transactions.userId, balance: BALANCE_EXPR })
        .from(transactions)
        .where(inArray(transactions.userId, userIds))
        .groupBy(transactions.userId);
    for (const r of rows) map.set(r.userId, Number(r.balance ?? 0));
    return map;
}

export type StatementLine = {
    id: number;
    amount: number;
    type: "credit" | "debit";
    kind: TransactionKind;
    status: "pending" | "confirmed" | "rejected";
    description: string | null;
    relatedDeliveryId: number | null;
    createdAt: string;
    creatorName: string | null;
    /** saldo depois desta linha (só anda com linhas confirmadas) */
    runningBalance: number;
};

export type Statement = {
    month: number;
    year: number;
    /** saldo antes do primeiro lançamento do mês */
    openingBalance: number;
    /** saldo geral, hoje */
    balance: number;
    totals: { corridas: number; dinheiro: number; pagamentos: number; ajustes: number; credit: number; debit: number };
    lines: StatementLine[];
};

function monthRange(month: number, year: number) {
    // createdAt é gravado em ISO UTC (CURRENT_TIMESTAMP ou toISOString) — comparar como texto funciona.
    const pad = (n: number) => String(n).padStart(2, "0");
    const start = `${year}-${pad(month)}-01`;
    const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
    return { start, next };
}

export async function getStatement(userId: number, month: number, year: number): Promise<Statement> {
    const { start, next } = monthRange(month, year);

    const openingRow = await db.select({ balance: BALANCE_EXPR })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), sql`${transactions.createdAt} < ${start}`))
        .get();
    const opening = Number(openingRow?.balance ?? 0);
    const [balance, rows] = await Promise.all([
        getBalance(userId),
        db.select({
            id: transactions.id,
            amount: transactions.amount,
            type: transactions.type,
            kind: transactions.kind,
            status: transactions.status,
            description: transactions.description,
            relatedDeliveryId: transactions.relatedDeliveryId,
            createdAt: transactions.createdAt,
            creatorName: users.name,
        })
            .from(transactions)
            .leftJoin(users, eq(transactions.creatorId, users.id))
            .where(and(
                eq(transactions.userId, userId),
                sql`${transactions.createdAt} >= ${start}`,
                sql`${transactions.createdAt} < ${next}`,
            ))
            .orderBy(transactions.createdAt, transactions.id),
    ]);

    const totals = { corridas: 0, dinheiro: 0, pagamentos: 0, ajustes: 0, credit: 0, debit: 0 };
    let running = opening;
    const asc: StatementLine[] = rows.map(r => {
        const signed = r.type === "credit" ? r.amount : -r.amount;
        if (r.status === "confirmed") {
            running += signed;
            if (r.type === "credit") totals.credit += r.amount; else totals.debit += r.amount;
            if (r.kind === "corrida") totals.corridas += r.amount;
            else if (r.kind === "dinheiro") totals.dinheiro += r.amount;
            else if (r.kind === "pagamento") totals.pagamentos += signed;
            else totals.ajustes += signed;
        }
        return {
            ...r,
            createdAt: r.createdAt ?? "",
            kind: (r.kind ?? "ajuste") as TransactionKind,
            runningBalance: running,
        };
    });

    return {
        month, year,
        openingBalance: opening,
        balance,
        totals,
        lines: asc.reverse(), // mais recente primeiro
    };
}

/** Meses que têm lançamento (pra navegação sem ficar clicando em mês vazio). */
export async function getActiveMonths(userId: number): Promise<{ month: number; year: number }[]> {
    const rows = await db
        .select({ ym: sql<string>`strftime('%Y-%m', ${transactions.createdAt})` })
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .groupBy(sql`strftime('%Y-%m', ${transactions.createdAt})`)
        .orderBy(desc(sql`strftime('%Y-%m', ${transactions.createdAt})`));
    return rows.map(r => ({ year: Number(r.ym.slice(0, 4)), month: Number(r.ym.slice(5, 7)) }));
}
