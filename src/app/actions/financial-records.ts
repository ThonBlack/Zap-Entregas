"use server";

import { db } from "@/db";
import { financialRecords } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function getFinancialRecordsAction(month?: number, year?: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) return { error: "Não autenticado" };

    const today = new Date();
    const targetMonth = month || today.getMonth() + 1;
    const targetYear = year || today.getFullYear();

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-31`; // Approx

    try {
        const records = await db.select()
            .from(financialRecords)
            .where(
                and(
                    eq(financialRecords.userId, Number(userId)),
                    // Simple string comparison for ISO dates (YYYY-MM-DD) works in SQLite
                    sql`${financialRecords.dueDate} >= ${startDate}`,
                    sql`${financialRecords.dueDate} <= ${endDate}`
                )
            )
            .orderBy(desc(financialRecords.dueDate));

        return { records };
    } catch (error: any) {
        console.error("Error fetching financial records:", error);
        return { error: `Erro: ${error.message}` };
    }
}

export async function createFinancialRecordAction(formData: FormData) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) return { error: "Não autenticado" };

    const description = formData.get("description") as string;
    const amountStr = formData.get("amount") as string;
    const type = formData.get("type") as "income" | "expense";
    const category = formData.get("category") as string;
    const dueDate = formData.get("dueDate") as string;
    const status = formData.get("status") as "pending" | "paid" | "overdue";

    if (!description || !amountStr || !type || !dueDate) {
        return { error: "Preencha os campos obrigatórios." };
    }

    const amount = parseFloat(amountStr.replace(',', '.'));

    try {
        await db.insert(financialRecords).values({
            userId: Number(userId),
            description,
            amount,
            type,
            category: category || "Geral",
            dueDate,
            status: status || "pending",
        });

        revalidatePath("/finance/manager");
        return { success: true };
    } catch (error) {
        console.error("Error creating record:", error);
        return { error: "Erro ao criar registro." };
    }
}

export async function deleteFinancialRecordAction(id: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) return { error: "Não autenticado" };

    try {
        await db.delete(financialRecords)
            .where(and(eq(financialRecords.id, id), eq(financialRecords.userId, Number(userId))));

        revalidatePath("/finance/manager");
        return { success: true };
    } catch (error) {
        return { error: "Erro ao deletar registro." };
    }
}

export async function markAsPaidAction(id: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) return { error: "Não autenticado" };

    try {
        await db.update(financialRecords)
            .set({ status: "paid" })
            .where(and(eq(financialRecords.id, id), eq(financialRecords.userId, Number(userId))));

        revalidatePath("/finance/manager");
        return { success: true };
    } catch (error) {
        return { error: "Erro ao atualizar registro." };
    }
}
