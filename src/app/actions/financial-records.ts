"use server";

import { db } from "@/db";
import { financialRecords } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/session";

function monthRange(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
    };
}

export async function getFinancialRecordsAction(month?: number, year?: number) {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;

    const today = new Date();
    const targetMonth = month || today.getMonth() + 1;
    const targetYear = year || today.getFullYear();
    const { start, end } = monthRange(targetYear, targetMonth);

    try {
        const records = await db.select()
            .from(financialRecords)
            .where(
                and(
                    eq(financialRecords.userId, auth.user.id),
                    sql`${financialRecords.dueDate} >= ${start}`,
                    sql`${financialRecords.dueDate} <= ${end}`
                )
            )
            .orderBy(desc(financialRecords.dueDate));

        return { records };
    } catch (error: any) {
        console.error("Error fetching financial records:", error);
        return { error: "Erro ao carregar registros." };
    }
}

export async function createFinancialRecordAction(formData: FormData) {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;

    const description = (formData.get("description") as string)?.trim();
    const amountStr = formData.get("amount") as string;
    const type = formData.get("type") as "income" | "expense";
    const category = (formData.get("category") as string) || "Geral";
    const dueDate = formData.get("dueDate") as string;
    const status = (formData.get("status") as string) || "pending";

    if (!description || !amountStr || !type || !dueDate) {
        return { error: "Preencha os campos obrigatórios." };
    }
    if (type !== "income" && type !== "expense") return { error: "Tipo inválido." };
    if (!["pending", "paid", "overdue"].includes(status)) return { error: "Status inválido." };

    const amount = parseFloat(amountStr.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Valor inválido." };

    try {
        await db.insert(financialRecords).values({
            userId: auth.user.id,
            description,
            amount,
            type,
            category,
            dueDate,
            status: status as "pending" | "paid" | "overdue",
        });

        revalidatePath("/finance/manager");
        return { success: true };
    } catch (error) {
        console.error("Error creating record:", error);
        return { error: "Erro ao criar registro." };
    }
}

export async function deleteFinancialRecordAction(id: number) {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido." };

    try {
        await db.delete(financialRecords)
            .where(and(eq(financialRecords.id, id), eq(financialRecords.userId, auth.user.id)));

        revalidatePath("/finance/manager");
        return { success: true };
    } catch {
        return { error: "Erro ao deletar registro." };
    }
}

export async function markAsPaidAction(id: number) {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido." };

    try {
        await db.update(financialRecords)
            .set({ status: "paid" })
            .where(and(eq(financialRecords.id, id), eq(financialRecords.userId, auth.user.id)));

        revalidatePath("/finance/manager");
        return { success: true };
    } catch {
        return { error: "Erro ao atualizar registro." };
    }
}
