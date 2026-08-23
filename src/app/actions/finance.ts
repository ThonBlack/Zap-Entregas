"use server";

import { db } from "@/db";
import { transactions, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthUser, getAuthUserWithRole } from "@/lib/session";
import { MANUAL_ENTRY_OPTIONS, safeReturnTo, type ManualEntryKey } from "@/lib/wallet";

export type ManualEntryState = { error?: string } | null;

export async function createTransactionAction(_prev: ManualEntryState, formData: FormData): Promise<ManualEntryState> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return { error: auth.error };
    const me = auth.user;

    const targetUserId = Number(formData.get("motoboyId"));
    const amountStr = String(formData.get("amount") ?? "");
    const entryKey = String(formData.get("entry") ?? "") as ManualEntryKey;
    const description = String(formData.get("description") ?? "").trim();
    const needsConfirmation = formData.get("needsConfirmation") === "on";
    const returnTo = String(formData.get("returnTo") ?? "") || "/app";

    const entry = MANUAL_ENTRY_OPTIONS[entryKey];
    if (!Number.isInteger(targetUserId) || targetUserId <= 0 || !amountStr || !entry) {
        return { error: "Preencha motoboy, tipo e valor." };
    }
    if (targetUserId === me.id) {
        return { error: "Não dá pra lançar na sua própria carteira." };
    }

    const amount = parseFloat(amountStr.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
        return { error: "Valor inválido." };
    }

    const target = await db.query.users.findFirst({
        where: eq(users.id, targetUserId),
        columns: { id: true, role: true },
    });
    if (!target || target.role !== "motoboy") {
        return { error: "Motoboy não encontrado." };
    }

    await db.insert(transactions).values({
        userId: targetUserId,
        creatorId: me.id,
        amount,
        type: entry.type,
        kind: entry.kind,
        description: description || entry.label,
        status: needsConfirmation ? "pending" : "confirmed",
    });

    revalidatePath("/app");
    revalidatePath("/motoboys");
    revalidatePath(`/motoboys/${targetUserId}/financeiro`);
    revalidatePath("/finance/extrato");
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
                sql`${transactions.createdAt} >= ${startDate}`,
                sql`${transactions.createdAt} <= ${endDate}`
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
                sql`${transactions.createdAt} >= ${startDate}`,
                sql`${transactions.createdAt} <= ${endDate}`
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
