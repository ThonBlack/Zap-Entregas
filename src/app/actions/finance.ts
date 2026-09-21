"use server";

import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthUser, getAuthUserWithRole } from "@/lib/session";
import { safeReturnTo } from "@/lib/wallet";
import { carregarMotoboyGerenciado } from "@/lib/team";
import { AVISO_CAMPOS, registrarLancamentoManual } from "@/lib/lancamentoManual";

export type ManualEntryState = { error?: string } | null;

export async function createTransactionAction(_prev: ManualEntryState, formData: FormData): Promise<ManualEntryState> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return { error: auth.error };
    const me = auth.user;

    const targetUserId = Number(formData.get("motoboyId"));
    const returnTo = String(formData.get("returnTo") ?? "") || "/app";

    // Sem motoboy escolhido o aviso é o do formulário incompleto, não o
    // "motoboy não encontrado" (que confundiria quem só esqueceu de escolher).
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return { error: AVISO_CAMPOS };
    }
    if (targetUserId === me.id) {
        return { error: "Não dá pra lançar na sua própria carteira." };
    }

    // Lançar dinheiro na carteira de um motoboy de OUTRA loja mexeria na dívida
    // dela. Só motoboy da própria equipe (admin passa por todos).
    const target = await carregarMotoboyGerenciado(me, targetUserId);
    if (!target) {
        return { error: "Motoboy não encontrado." };
    }

    // O resto da regra (valor, data do lançamento e trava de cópia) mora em
    // src/lib/lancamentoManual.ts, pra poder ser testada sem sessão.
    const r = await registrarLancamentoManual({
        motoboyId: targetUserId,
        creatorId: me.id,
        valorDigitado: String(formData.get("amount") ?? ""),
        entryKey: String(formData.get("entry") ?? ""),
        descricao: String(formData.get("description") ?? ""),
        precisaConfirmar: formData.get("needsConfirmation") === "on",
        dataDigitada: formData.get("data"),
    });
    if (!r.ok) return { error: r.erro };

    revalidatePath("/app");
    revalidatePath("/motoboys");
    revalidatePath(`/motoboys/${targetUserId}/financeiro`);
    revalidatePath(`/motoboys/${targetUserId}/financeiro/controle`);
    revalidatePath(`/motoboys/${targetUserId}/fechamento`);
    revalidatePath("/finance/extrato");
    revalidatePath("/finance/extrato/controle");
    redirect(safeReturnTo(returnTo));
}

export async function confirmTransactionAction(id: number) {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;

    await db.update(transactions)
        .set({ status: "confirmed" })
        .where(
            and(
                eq(transactions.id, id),
                eq(transactions.userId, auth.user.id),
                eq(transactions.status, "pending")
            )
        );

    revalidatePath("/app");
    revalidatePath("/finance/extrato");
    revalidatePath("/motoboys");
    revalidatePath(`/motoboys/${auth.user.id}/financeiro`);
    return { success: true };
}

export async function rejectTransactionAction(id: number) {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;

    await db.update(transactions)
        .set({ status: "rejected" })
        .where(
            and(
                eq(transactions.id, id),
                eq(transactions.userId, auth.user.id),
                eq(transactions.status, "pending")
            )
        );

    revalidatePath("/app");
    revalidatePath("/finance/extrato");
    revalidatePath("/motoboys");
    revalidatePath(`/motoboys/${auth.user.id}/financeiro`);
    return { success: true };
}

export async function getFinancialStatsAction(month: number, year: number) {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;
    const user = auth.user;

    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    let data: { day: string; amount: number }[] = [];

    if (user.role === "motoboy") {
        data = await db.select({
            day: sql<string>`strftime('%d', ${transactions.createdAt})`,
            amount: sql<number>`SUM(${transactions.amount})`,
        })
            .from(transactions)
            .where(and(
                eq(transactions.userId, user.id),
                eq(transactions.type, "credit"),
                eq(transactions.status, "confirmed"),
                sql`datetime(${transactions.createdAt}) >= datetime(${startDate})`,
                sql`datetime(${transactions.createdAt}) <= datetime(${endDate})`
            ))
            .groupBy(sql`strftime('%d', ${transactions.createdAt})`)
            .orderBy(sql`strftime('%d', ${transactions.createdAt})`);
    } else {
        data = await db.select({
            day: sql<string>`strftime('%d', ${transactions.createdAt})`,
            amount: sql<number>`SUM(${transactions.amount})`,
        })
            .from(transactions)
            .where(and(
                eq(transactions.creatorId, user.id),
                eq(transactions.type, "credit"),
                eq(transactions.status, "confirmed"),
                sql`datetime(${transactions.createdAt}) >= datetime(${startDate})`,
                sql`datetime(${transactions.createdAt}) <= datetime(${endDate})`
            ))
            .groupBy(sql`strftime('%d', ${transactions.createdAt})`)
            .orderBy(sql`strftime('%d', ${transactions.createdAt})`);
    }

    const total = data.reduce((acc, curr) => acc + curr.amount, 0);

    return {
        data: data.map(d => ({ day: parseInt(d.day), value: d.amount })),
        total,
        role: user.role,
    };
}
