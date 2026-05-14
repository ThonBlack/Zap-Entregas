"use server";

import { db } from "@/db";
import { transactions, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthUser, getAuthUserWithRole } from "@/lib/session";

export async function createTransactionAction(formData: FormData) {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    const targetUserId = Number(formData.get("motoboyId"));
    const amountStr = formData.get("amount") as string;
    const type = formData.get("type") as "credit" | "debit";
    const description = formData.get("description") as string;

    if (!Number.isInteger(targetUserId) || targetUserId <= 0 || !amountStr || !type) {
        return { error: "Preencha todos os campos obrigatórios." };
    }
    if (type !== "credit" && type !== "debit") {
        return { error: "Tipo inválido." };
    }
    if (targetUserId === me.id) {
        return { error: "Não é possível lançar transação para você mesmo." };
    }

    const amount = parseFloat(amountStr.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
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
        type,
        description:
            description ||
            (type === "credit" ? "Pagamento efetuado pelo lojista" : "Recebimento do lojista"),
        status: "pending",
    });

    redirect("/app");
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
