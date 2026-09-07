"use server";

import { db } from "@/db";
import { users, plans, deliveries } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export interface PlanLimits {
    maxDeliveries: number;
    maxMotoboys: number;
    planName: string;
    isUnlimited: boolean;
}

// Busca limites do plano do usuário
export async function getUserPlanLimits(userId: number): Promise<PlanLimits> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) {
        return { maxDeliveries: 0, maxMotoboys: 0, planName: "none", isUnlimited: false };
    }

    const plan = await db.query.plans.findFirst({
        where: eq(plans.name, user.plan.charAt(0).toUpperCase() + user.plan.slice(1)) // Capitalize: "free" -> "Free"
    });

    if (!plan) {
        // Fallback para plano free se não encontrar
        return { maxDeliveries: 30, maxMotoboys: 1, planName: "free", isUnlimited: false };
    }

    return {
        maxDeliveries: plan.maxDeliveries ?? 30,
        maxMotoboys: plan.maxMotoboys ?? 1,
        planName: plan.name,
        isUnlimited: (plan.maxDeliveries ?? 0) >= 99999
    };
}

// Conta entregas do mês atual do lojista.
// O mês é o de BRASÍLIA (UTC−3) e a comparação passa por `datetime()`: created_at
// convive em dois formatos no banco ("2026-09-01 10:00:00" das linhas antigas e
// ISO com T/Z das novas) e comparar como texto excluía todas as corridas do dia 1.
export async function countMonthlyDeliveries(shopkeeperId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
        .from(deliveries)
        .where(and(
            eq(deliveries.shopkeeperId, shopkeeperId),
            sql`date(datetime(${deliveries.createdAt}, '-3 hours'), 'start of month') = date('now', '-3 hours', 'start of month')`
        ));

    return result[0]?.count ?? 0;
}

// Verifica se usuário pode criar mais entregas
export async function canCreateDelivery(userId: number): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
    const limits = await getUserPlanLimits(userId);

    // Planos ilimitados sempre podem
    if (limits.isUnlimited) {
        return { allowed: true };
    }

    const monthlyCount = await countMonthlyDeliveries(userId);
    const remaining = limits.maxDeliveries - monthlyCount;

    if (monthlyCount >= limits.maxDeliveries) {
        return {
            allowed: false,
            reason: `Limite de ${limits.maxDeliveries} entregas/mês atingido. Faça upgrade do plano.`,
            remaining: 0
        };
    }

    return { allowed: true, remaining };
}

// Para uso no admin: força upgrade de plano sem pagamento
export async function adminSetUserPlan(adminId: number, targetUserId: number, planSlug: string): Promise<{ success: boolean; error?: string }> {
    // Verificar se quem está fazendo é admin
    const admin = await db.query.users.findFirst({
        where: eq(users.id, adminId)
    });

    if (admin?.role !== "admin") {
        return { success: false, error: "Acesso negado. Apenas admins podem alterar planos." };
    }

    // Verificar se o plano existe
    const plan = await db.query.plans.findFirst({
        where: eq(plans.name, planSlug.charAt(0).toUpperCase() + planSlug.slice(1))
    });

    if (!plan) {
        return { success: false, error: "Plano não encontrado." };
    }

    // Atualizar usuário - planSlug deve ser um dos valores válidos do enum
    const validPlans = ["free", "basic", "pro", "growth", "enterprise"] as const;
    if (!validPlans.includes(planSlug as any)) {
        return { success: false, error: "Plano inválido." };
    }

    await db.update(users)
        .set({
            plan: planSlug as typeof validPlans[number],
            isTrialUser: false,
            subscriptionStatus: "active"
        })
        .where(eq(users.id, targetUserId));

    return { success: true };
}
