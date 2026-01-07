"use server";

import { db } from "@/db";
import { deliveries, transactions, shopSettings, users } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { geocodeAddress, optimizeRoute } from "@/lib/routeUtils";

// 1. Quick Add Delivery (Single, no optimization yet)
export async function addDeliveryAction(formData: FormData) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    const address = formData.get("address") as string;
    const customerName = formData.get("customerName") as string;
    const value = parseFloat((formData.get("value") as string)?.replace(',', '.') || "0");
    const observation = formData.get("observation") as string;

    if (!address) return { error: "Endereço obrigatório" };

    // Prevent double submission (Idempotency Check - 60s)
    const recent = await db.query.deliveries.findFirst({
        where: and(
            eq(deliveries.shopkeeperId, Number(userId)),
            eq(deliveries.address, address),
            gt(deliveries.createdAt, new Date(Date.now() - 60000).toISOString())
        )
    });

    if (recent) return { error: "Entrega já adicionada recentemente." };

    try {
        const coords = await geocodeAddress(address);
        if (coords) {
            lat = coords.lat;
            lng = coords.lng;
        }
    } catch (e) {
        console.error("Geocode form failed", e);
    }

    await db.insert(deliveries).values({
        shopkeeperId: Number(userId),
        address,
        customerName,
        value,
        observation,
        lat,
        lng,
        status: "pending",
        stopOrder: 999
    });

    revalidatePath("/");
    return { success: true };
}

// ... (optimizeSelectedRouteAction stays same) ...

// 3. Delete Delivery
export async function deleteDeliveryAction(id: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    try {
        console.log(`[DELETE] User ${userId} deleting delivery ${id}`);
        // Check if exists
        const del = await db.query.deliveries.findFirst({ where: eq(deliveries.id, id) });
        if (!del) return { error: "Entrega não encontrada" };

        await db.delete(deliveries).where(eq(deliveries.id, id));
        revalidatePath("/");
        return { success: true };
    } catch (e) {
        console.error(`[DELETE ERROR]`, e);
        return { error: "Erro ao excluir. Verifique se existem registros associados." };
    }
}

// 4. Complete Delivery (with privacy implications handled in History view)
export async function completeDeliveryAction(id: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    try {
        // 1. Get Shop Settings for calculation
        // We need to know WHO is the shopkeeper for this delivery to get their settings
        const delivery = await db.query.deliveries.findFirst({
            where: eq(deliveries.id, id),
            with: {
                shopkeeper: true
            }
        });

        if (!delivery) return { error: "Entrega não encontrada." };

        const shopId = delivery.shopkeeperId;
        if (shopId) {
            const settings = await db.query.shopSettings.findFirst({
                where: eq(shopSettings.userId, shopId)
            });

            if (settings) {
                let fee = 0;
                // Simple MVP Logic: Fixed Value Only for now (as requested)
                // Expanded logic:
                if (settings.remunerationModel === 'fixed' || settings.remunerationModel === 'hybrid') {
                    fee += (settings.fixedValue || 0);
                }

                // If distance calculation is needed, we would need distance between points.
                // For now, MVP assumes Fixed.

                if (fee > 0) {
                    // Create Transaction: Credit to Motoboy
                    await db.insert(transactions).values({
                        userId: Number(userId), // Motoboy receives
                        amount: fee,
                        type: 'credit',
                        description: `Corrida #${id} - ${delivery.customerName || 'Cliente'}`,
                        relatedDeliveryId: id,
                        creatorId: shopId, // Shopkeeper "pays" (conceptually)
                        status: 'confirmed'
                    });

                    // Update delivery fee for record
                    await db.update(deliveries).set({ fee }).where(eq(deliveries.id, id));
                }
            }
        }

        await db.update(deliveries)
            .set({
                status: 'delivered',
                motoboyId: Number(userId),
                updatedAt: new Date().toISOString()
            })
            .where(eq(deliveries.id, id));

        revalidatePath("/");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "Erro ao finalizar" };
    }
}
