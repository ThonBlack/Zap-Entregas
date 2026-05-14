"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/password";
import { getAuthUserWithRole } from "@/lib/session";

export async function updateUserPlanAction(targetUserId: number, newPlan: string) {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) return auth;

    const validPlans = ["free", "basic", "pro", "growth", "enterprise"] as const;
    if (!validPlans.includes(newPlan as any)) {
        return { error: "Plano inválido" };
    }

    await db.update(users)
        .set({ plan: newPlan as typeof validPlans[number] })
        .where(eq(users.id, targetUserId));

    revalidatePath("/admin");
    return { success: true };
}

export async function updateUserStatusAction(targetUserId: number, newStatus: string) {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) return auth;

    if (!["active", "inactive", "trial"].includes(newStatus)) {
        return { error: "Status inválido" };
    }

    await db.update(users)
        .set({ subscriptionStatus: newStatus as "active" | "inactive" | "trial" })
        .where(eq(users.id, targetUserId));

    revalidatePath("/admin");
    return { success: true };
}

export async function deleteUserAction(targetUserId: number) {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) return auth;

    await db.update(users)
        .set({ subscriptionStatus: "inactive", isActive: false })
        .where(eq(users.id, targetUserId));

    revalidatePath("/admin");
    return { success: true };
}

export async function adminResetUserPasswordAction(targetUserId: number, newPassword: string) {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) return auth;

    if (!newPassword || newPassword.length < 8) {
        return { error: "Senha deve ter pelo menos 8 caracteres" };
    }

    const hashedPassword = await hashPassword(newPassword);

    await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, targetUserId));

    revalidatePath("/admin");
    return { success: true, message: "Senha alterada com sucesso" };
}

export async function adminToggleUserActiveAction(targetUserId: number, active: boolean) {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) return auth;

    await db.update(users)
        .set({ isActive: active })
        .where(eq(users.id, targetUserId));

    revalidatePath("/admin");
    return { success: true, message: active ? "Usuário ativado" : "Usuário desativado" };
}
