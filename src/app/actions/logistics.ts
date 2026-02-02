"use server";

import { db } from "@/db";
import { deliveries, transactions, shopSettings, users, subscriptions, plans } from "@/db/schema";
import { eq, inArray, and, gt, desc } from "drizzle-orm";
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

    // Prevent double submission (Idempotency Check - 5 minutes)
    const recent = await db.query.deliveries.findFirst({
        where: and(
            eq(deliveries.shopkeeperId, Number(userId)),
            eq(deliveries.address, address),
            gt(deliveries.createdAt, new Date(Date.now() - 300000).toISOString()) // 5 minutos
        )
    });

    if (recent) return { error: "Entrega já adicionada recentemente." };

    // Try to geocode immediately, but don't blocking if fails (can be done later or in background)
    let lat = 0, lng = 0;
    try {
        const coords = await geocodeAddress(address);
        if (coords) {
            lat = coords.lat;
            lng = coords.lng;
        }
    } catch (e) {
        console.error("Geocode form failed", e);
    }

    // TODO: Add plan limits verification when needed
    // For MVP, allow all deliveries

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

// 4. Accept Delivery - Motoboy accepts a pending delivery
export async function acceptDeliveryAction(id: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    try {
        // Verificar se a entrega ainda está disponível
        const delivery = await db.query.deliveries.findFirst({
            where: and(
                eq(deliveries.id, id),
                eq(deliveries.status, 'pending')
            )
        });

        if (!delivery) {
            return { error: "Entrega não disponível ou já foi aceita." };
        }

        // Verificar se já tem motoboy atribuído
        if (delivery.motoboyId) {
            return { error: "Esta entrega já foi aceita por outro motoboy." };
        }

        // Atribuir ao motoboy
        await db.update(deliveries)
            .set({
                motoboyId: Number(userId),
                status: 'assigned',
                acceptedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
            .where(and(
                eq(deliveries.id, id),
                eq(deliveries.status, 'pending') // Double-check para evitar race condition
            ));

        revalidatePath("/");
        return { success: true };
    } catch (e) {
        console.error("[ACCEPT ERROR]", e);
        return { error: "Erro ao aceitar entrega." };
    }
}

// 5. Pickup Delivery - Motoboy picked up the order from shop
export async function pickupDeliveryAction(id: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    try {
        // Verificar se a entrega existe e pertence a este motoboy
        const delivery = await db.query.deliveries.findFirst({
            where: and(
                eq(deliveries.id, id),
                eq(deliveries.motoboyId, Number(userId)),
                eq(deliveries.status, 'assigned')
            )
        });

        if (!delivery) {
            return { error: "Entrega não encontrada ou não atribuída a você." };
        }

        await db.update(deliveries)
            .set({
                status: 'picked_up',
                pickedUpAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
            .where(eq(deliveries.id, id));

        revalidatePath("/");
        return { success: true };
    } catch (e) {
        console.error("[PICKUP ERROR]", e);
        return { error: "Erro ao marcar coleta." };
    }
}

// 6. Complete Delivery (with race condition protection)
export async function completeDeliveryAction(id: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    try {
        // Verificar se a entrega existe e está em status válido para completar
        const delivery = await db.query.deliveries.findFirst({
            where: and(
                eq(deliveries.id, id),
                inArray(deliveries.status, ['assigned', 'picked_up', 'pending'])
            ),
            with: {
                shopkeeper: true
            }
        });

        if (!delivery) {
            return { error: "Entrega não encontrada ou já foi finalizada." };
        }

        // Se já foi entregue, retornar sucesso sem duplicar
        if (delivery.status === 'delivered') {
            return { success: true, alreadyDelivered: true };
        }

        const shopId = delivery.shopkeeperId;
        let fee = 0;

        // Calcular taxa se houver configuração do lojista
        if (shopId) {
            const settings = await db.query.shopSettings.findFirst({
                where: eq(shopSettings.userId, shopId)
            });

            if (settings) {
                if (settings.remunerationModel === 'fixed' || settings.remunerationModel === 'hybrid') {
                    fee = settings.fixedValue || 0;
                }
            }
        }

        // Verificar se já existe transação para esta entrega (evitar duplicata)
        const existingTransaction = await db.query.transactions.findFirst({
            where: eq(transactions.relatedDeliveryId, id)
        });

        // Criar transação apenas se não existir e tiver fee
        if (!existingTransaction && fee > 0) {
            await db.insert(transactions).values({
                userId: Number(userId),
                amount: fee,
                type: 'credit',
                description: `Corrida #${id} - ${delivery.customerName || 'Cliente'}`,
                relatedDeliveryId: id,
                creatorId: shopId,
                status: 'confirmed'
            });
        }

        // Atualizar entrega
        await db.update(deliveries)
            .set({
                status: 'delivered',
                fee,
                motoboyId: Number(userId),
                deliveredAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
            .where(eq(deliveries.id, id));

        revalidatePath("/");

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://zapentregas.duckdns.org";
        return {
            success: true,
            reviewUrl: `${baseUrl}/review/${id}`,
            customerPhone: delivery.customerPhone,
            customerName: delivery.customerName || "Cliente"
        };
    } catch (e) {
        console.error("[COMPLETE ERROR]", e);
        return { error: "Erro ao finalizar" };
    }
}

