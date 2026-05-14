"use server";

import { db } from "../../db";
import { plans } from "../../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthUserWithRole } from "../../lib/session";

export async function updatePlanAction(id: number, formData: FormData) {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) return auth;

    const price = parseFloat(formData.get("price") as string);
    const maxMotoboys = parseInt(formData.get("maxMotoboys") as string);
    const maxDeliveries = parseInt(formData.get("maxDeliveries") as string);
    const pricePerExtraDelivery = parseFloat(formData.get("pricePerExtraDelivery") as string);

    if (!Number.isFinite(price) || price < 0) return { error: "Preço inválido" };
    if (!Number.isInteger(maxMotoboys) || maxMotoboys < 0) return { error: "Limite de motoboys inválido" };
    if (!Number.isInteger(maxDeliveries) || maxDeliveries < 0) return { error: "Limite de entregas inválido" };
    if (!Number.isFinite(pricePerExtraDelivery) || pricePerExtraDelivery < 0) return { error: "Preço por extra inválido" };

    await db.update(plans)
        .set({
            price,
            maxMotoboys,
            maxDeliveries,
            pricePerExtraDelivery,
        })
        .where(eq(plans.id, id));

    revalidatePath("/admin/plans");
    revalidatePath("/admin");
    return { success: true };
}

export async function togglePlanStatusAction(id: number, currentStatus: boolean) {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) return auth;

    await db.update(plans)
        .set({ isActive: !currentStatus })
        .where(eq(plans.id, id));

    revalidatePath("/admin/plans");
    return { success: true };
}
