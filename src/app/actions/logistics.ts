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

    // Try to geocode immediately, but don't blocking if fails (can be done later or in background)
    let lat = 0, lng = 0;
    try {
        const coords = await geocodeAddress(address);
        if (coords) {
            lat = coords.lat;
            lng = coords.lng;
        }
    } catch (e) {
        console.error("Geocode failed for quick add", e);
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
        stopOrder: 999 // High number, effectively unordered
    });

    redirect("/");
}

// 2. Optimize Selected Deliveries
export async function optimizeSelectedRouteAction(selectedIds: number[]) {
    if (!selectedIds.length) {
        return { error: "Selecione pelo menos uma entrega." };
    }

    // Fetch full delivery objects
    const targets = await db.select().from(deliveries).where(inArray(deliveries.id, selectedIds));

    // Ensure all have coordinates
    const points = await Promise.all(targets.map(async (d, index) => {
        let lat = d.lat || 0;
        let lng = d.lng || 0;

        // If missing coords, try geocode again
        if (lat === 0 || lng === 0) {
            const coords = await geocodeAddress(d.address);
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
                // Update DB so we don't fetch again
                await db.update(deliveries).set({ lat, lng }).where(eq(deliveries.id, d.id));
            }
        }

        return {
            id: d.id,
            index, // Keep track of original index if needed, but ID is better
            lat,
            lng,
            address: d.address
        };
    }));

    // Filter valid points for optimization
    const validPoints = points.filter(p => p.lat !== 0);

    // Run Optimization (TSP / Nearest Neighbor)
    let optimized: typeof validPoints = [];
    if (validPoints.length > 0) {
        optimized = optimizeRoute(validPoints[0], validPoints);
    } else {
        // Fallback for all failed geocodes
        optimized = points;
    }

    // Missing/Failed points go to the end
    const failedPoints = points.filter(p => p.lat === 0);
    const finalOrder = [...optimized, ...failedPoints];

    // Update stopOrder in DB
    await Promise.all(finalOrder.map((p, i) => {
        return db.update(deliveries)
            .set({ stopOrder: i + 1 })
            .where(eq(deliveries.id, p.id!));
    }));

    revalidatePath("/");

    // Generate Maps URL
    if (finalOrder.length > 0) {
        // Destination is the last one, others are waypoints
        const destination = finalOrder[finalOrder.length - 1].address;
        const waypoints = finalOrder.slice(0, -1).map(p => p.address).join('|');
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}`;
        return { success: true, url };
    }

    return { success: true, url: "" };
}
// 3. Delete Delivery
export async function deleteDeliveryAction(id: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    try {
        await db.delete(deliveries).where(eq(deliveries.id, id));
        revalidatePath("/");
        return { success: true };
    } catch (e) {
        return { error: "Erro ao excluir" };
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
