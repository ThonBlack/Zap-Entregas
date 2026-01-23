"use server";

import { db } from "../../db";
import { plans } from "../../db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updatePlanAction(id: number, formData: FormData) {
    const price = parseFloat(formData.get("price") as string);
    const maxMotoboys = parseInt(formData.get("maxMotoboys") as string);
    const maxDeliveries = parseInt(formData.get("maxDeliveries") as string);
    const pricePerExtraDelivery = parseFloat(formData.get("pricePerExtraDelivery") as string);

    await db.update(plans)
        .set({
            price,
            maxMotoboys,
            maxDeliveries,
            pricePerExtraDelivery
        })
        .where(eq(plans.id, id));

    revalidatePath("/admin/plans");
    revalidatePath("/admin"); // Update dashboard cards too
    return { success: true };
}

export async function togglePlanStatusAction(id: number, currentStatus: boolean) {
    await db.update(plans)
        .set({ isActive: !currentStatus })
        .where(eq(plans.id, id));

    revalidatePath("/admin/plans");
    return { success: true };
}
