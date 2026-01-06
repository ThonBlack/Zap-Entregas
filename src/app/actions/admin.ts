"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

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

    // This is dangerous cascading delete, simpler logic for now: just mark inactive?
    // User requested "delete" for deliveries, maybe for users too?
    // Let's actually delete for "cleanup" but warn about constraints.
    // For now, let's keep it safe: just clean access.
    // If strict delete is needed, we need to handle FKs.
    // Let's stick to status inactive for now as "soft delete"

    await db.update(users)
        .set({ subscriptionStatus: 'inactive' })
        .where(eq(users.id, targetUserId));

    revalidatePath("/admin");
    return { success: true };
}
