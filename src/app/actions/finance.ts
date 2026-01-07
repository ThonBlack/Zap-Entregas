"use server";

import { db } from "@/db";
import { transactions, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createTransactionAction(formData: FormData) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) return { error: "Não autenticado" };

    // Get form data
    const targetUserId = formData.get("motoboyId") as string;
    const amountStr = formData.get("amount") as string;
    const type = formData.get("type") as "credit" | "debit";
    const description = formData.get("description") as string;

    if (!targetUserId || !amountStr || !type) {
        return { error: "Preencha todos os campos obrigatórios." };
    }

    const amount = parseFloat(amountStr.replace(',', '.')); // Handle PT-BR decimal

    if (isNaN(amount) || amount <= 0) {
        return { error: "Valor inválido." };
    }

    // Insert transaction
    // Note: 
    // If Shopkeeper PAYS Motoboy -> Credit to Motoboy (Reduces debt to shop or increases balance)
    // If Motoboy PAYS Shopkeeper -> Debit to Motoboy (Reduces credit or increases debt to shop)
    // Wait, let's align with the Dashboard logic:
    // Dashboard: Credit (+) adds to balance, Debit (-) subtracts.
    // "O lojista deve a você" -> Positive Balance.
    // "Você deve ao lojista" -> Negative Balance.

    // Scenario 1: Motoboy delivered R$ 100 in products (Cash). He owes R$ 100 to Shop.
    // We haven't implemented automatic delivery debit yet.

    // Scenario 2: Manual Payment.
    // Shopkeeper gives R$ 50 to Motoboy (Gas money).
    // This is money the Motoboy RECEIVED. Does it increase his debt? No, it's a payment FOR service (Credit).
    // OR it's a loan (Debit)?

    // Let's use explicitly:
    // "Pagar Motoboy" (Despesa do Lojista/Ganho do Motoboy) -> Credit (+). 
    //    Example: Paying delivery fees accumulator.
    // "Receber do Motoboy" (Receita do Lojista/Gasto do Motoboy) -> Debit (-).
    //    Example: Motoboy returning cash from deliveries.

    await db.insert(transactions).values({
        userId: Number(targetUserId),
        creatorId: Number(userId),
        amount: amount,
        type: type,
        description: description || (type === 'credit' ? 'Pagamento efetuado pelo lojista' : 'Recebimento do lojista'),
        status: 'pending' // Always pending confirmation now
    });

    redirect("/");
}

export async function confirmTransactionAction(id: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    // Security: ensure the user confirming is the TARGET of the transaction, not the creator
    await db.update(transactions)
        .set({ status: 'confirmed' })
        .where(
            and(
                eq(transactions.id, id),
                eq(transactions.userId, Number(userId)),
                eq(transactions.status, 'pending')
            )
        );

    revalidatePath("/");
    return { success: true };
}

export async function rejectTransactionAction(id: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    await db.update(transactions)
        .set({ status: 'rejected' })
        .where(
            and(
                eq(transactions.id, id),
                eq(transactions.userId, Number(userId)),
                eq(transactions.status, 'pending')
            )
        );

    revalidatePath("/");
    return { success: true };
}

export async function getFinancialStatsAction(month: number, year: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId)),
    });
    if (!user) return { error: "Usuário não encontrado" };

    // Define Date Range
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    let data: { day: string; amount: number }[] = [];

    if (user.role === 'motoboy') {
        // Motoboy: Calculates INCOME (Credits received)
        data = await db.select({
            day: sql<string>`strftime('%d', ${transactions.createdAt})`,
            amount: sql<number>`SUM(${transactions.amount})`
        })
            .from(transactions)
            .where(and(
                eq(transactions.userId, user.id),
                eq(transactions.type, 'credit'),
                eq(transactions.status, 'confirmed'),
                sql`${transactions.createdAt} >= ${startDate}`,
                sql`${transactions.createdAt} <= ${endDate}`
            ))
            .groupBy(sql`strftime('%d', ${transactions.createdAt})`)
            .orderBy(sql`strftime('%d', ${transactions.createdAt})`);

    } else {
        // Shopkeeper: Calculates EXPENSES (Money sent to motoboys)
        data = await db.select({
            day: sql<string>`strftime('%d', ${transactions.createdAt})`,
            amount: sql<number>`SUM(${transactions.amount})`
        })
            .from(transactions)
            .where(and(
                eq(transactions.creatorId, user.id),
                eq(transactions.type, 'credit'),
                eq(transactions.status, 'confirmed'),
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
        role: user.role
    };
}
