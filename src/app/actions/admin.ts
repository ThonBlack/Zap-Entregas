"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/password";

async function checkAdmin() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return false;

    const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId)),
    });

    return user?.role === 'admin';
}

export async function updateUserPlanAction(targetUserId: number, newPlan: string) {
    if (!(await checkAdmin())) return { error: "Não autorizado" };

    if (!['free', 'pro', 'enterprise'].includes(newPlan)) {
        return { error: "Plano inválido" };
    }

    await db.update(users)
        .set({ plan: newPlan as "free" | "pro" | "enterprise" })
        .where(eq(users.id, targetUserId));

    revalidatePath("/admin");
    return { success: true };
}

export async function updateUserStatusAction(targetUserId: number, newStatus: string) {
    if (!(await checkAdmin())) return { error: "Não autorizado" };

    await db.update(users)
        .set({ subscriptionStatus: newStatus as "active" | "inactive" | "trial" })
        .where(eq(users.id, targetUserId));

    revalidatePath("/admin");
    return { success: true };
}

export async function deleteUserAction(targetUserId: number) {
    if (!(await checkAdmin())) return { error: "Não autorizado" };

    // Soft delete: marca como inativo
    await db.update(users)
        .set({ subscriptionStatus: 'inactive', isActive: false })
        .where(eq(users.id, targetUserId));

    revalidatePath("/admin");
    return { success: true };
}

/**
 * Reset manual de senha por admin (emergência)
 */
export async function adminResetUserPasswordAction(targetUserId: number, newPassword: string) {
    if (!(await checkAdmin())) return { error: "Não autorizado" };

    if (!newPassword || newPassword.length < 4) {
        return { error: "Senha deve ter pelo menos 4 caracteres" };
    }

    const hashedPassword = await hashPassword(newPassword);

    await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, targetUserId));

    console.log(`[Admin] Senha resetada para usuário ID ${targetUserId}`);
    revalidatePath("/admin");
    return { success: true, message: "Senha alterada com sucesso" };
}

/**
 * Ativar/desativar usuário (bloqueia login)
 */
export async function adminToggleUserActiveAction(targetUserId: number, active: boolean) {
    if (!(await checkAdmin())) return { error: "Não autorizado" };

    await db.update(users)
        .set({ isActive: active })
        .where(eq(users.id, targetUserId));

    console.log(`[Admin] Usuário ID ${targetUserId} ${active ? 'ativado' : 'desativado'}`);
    revalidatePath("/admin");
    return { success: true, message: active ? "Usuário ativado" : "Usuário desativado" };
}
