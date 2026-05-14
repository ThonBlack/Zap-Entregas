"use server";

import { db } from "@/db";
import { deliveries, transactions, shopSettings } from "@/db/schema";
import { eq, inArray, and, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { geocodeAddress, optimizeRoute } from "@/lib/routeUtils";
import { getAuthUser, getAuthUserWithRole } from "@/lib/session";

export async function addDeliveryAction(formData: FormData) {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    const address = (formData.get("address") as string)?.trim();
    const customerName = formData.get("customerName") as string;
    const value = parseFloat((formData.get("value") as string)?.replace(",", ".") || "0");
    const observation = formData.get("observation") as string;

    if (!address) return { error: "Endereço obrigatório" };

    const recent = await db.query.deliveries.findFirst({
        where: and(
            eq(deliveries.shopkeeperId, me.id),
            eq(deliveries.address, address),
            gt(deliveries.createdAt, new Date(Date.now() - 300000).toISOString())
        ),
    });

    if (recent) return { error: "Entrega já adicionada recentemente." };

    let lat = 0, lng = 0;
    try {
        const coords = await geocodeAddress(address);
        if (coords) { lat = coords.lat; lng = coords.lng; }
    } catch (e) {
        console.error("Geocode form failed", e);
    }

    const { canCreateDelivery } = await import("@/lib/planLimits");
    const limitCheck = await canCreateDelivery(me.id);

    if (!limitCheck.allowed) {
        return { error: limitCheck.reason || "Limite de entregas atingido." };
    }

    await db.insert(deliveries).values({
        shopkeeperId: me.id,
        address,
        customerName,
        value: Number.isFinite(value) ? value : 0,
        observation,
        lat,
        lng,
        status: "pending",
        stopOrder: 999,
    });

    revalidatePath("/app");
    return { success: true };
}

export async function optimizeSelectedRouteAction(selectedIds: number[]) {
    const auth = await getAuthUserWithRole(["shopkeeper", "motoboy", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!selectedIds?.length) {
        return { error: "Selecione pelo menos uma entrega." };
    }

    const cleanIds = selectedIds.filter(n => Number.isInteger(n) && n > 0);
    if (!cleanIds.length) return { error: "IDs inválidos." };

    const targets = await db.select().from(deliveries).where(inArray(deliveries.id, cleanIds));

    const visible = targets.filter(d =>
        me.role === "admin" ||
        (me.role === "shopkeeper" && d.shopkeeperId === me.id) ||
        (me.role === "motoboy" && (d.motoboyId === me.id || d.status === "pending"))
    );

    if (!visible.length) return { error: "Nenhuma entrega autorizada para você." };

    const points = await Promise.all(visible.map(async (d, index) => {
        let lat = d.lat || 0;
        let lng = d.lng || 0;

        if (lat === 0 || lng === 0) {
            const coords = await geocodeAddress(d.address);
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
                await db.update(deliveries).set({ lat, lng }).where(eq(deliveries.id, d.id));
            }
        }

        return { id: d.id, index, lat, lng, address: d.address };
    }));

    const validPoints = points.filter(p => p.lat !== 0);

    let optimized: typeof validPoints = [];
    if (validPoints.length > 0) {
        optimized = optimizeRoute(validPoints[0], validPoints);
    } else {
        optimized = points;
    }

    const failedPoints = points.filter(p => p.lat === 0);
    const finalOrder = [...optimized, ...failedPoints];

    await Promise.all(finalOrder.map((p, i) =>
        db.update(deliveries).set({ stopOrder: i + 1 }).where(eq(deliveries.id, p.id!))
    ));

    revalidatePath("/app");

    if (finalOrder.length > 0) {
        const destination = finalOrder[finalOrder.length - 1].address;
        const waypoints = finalOrder.slice(0, -1).map(p => p.address).join("|");
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}`;
        return { success: true, url };
    }

    return { success: true, url: "" };
}

export async function deleteDeliveryAction(id: number) {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido" };

    const del = await db.query.deliveries.findFirst({ where: eq(deliveries.id, id) });
    if (!del) return { error: "Entrega não encontrada" };

    const canDelete =
        me.role === "admin" ||
        (me.role === "shopkeeper" && del.shopkeeperId === me.id);

    if (!canDelete) return { error: "Sem permissão para excluir esta entrega." };

    try {
        await db.delete(deliveries).where(eq(deliveries.id, id));
        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[DELETE ERROR]", e);
        return { error: "Erro ao excluir. Verifique se existem registros associados." };
    }
}

export async function acceptDeliveryAction(id: number) {
    const auth = await getAuthUserWithRole(["motoboy", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido" };

    try {
        const delivery = await db.query.deliveries.findFirst({
            where: and(eq(deliveries.id, id), eq(deliveries.status, "pending")),
        });

        if (!delivery) return { error: "Entrega não disponível ou já foi aceita." };
        if (delivery.motoboyId) return { error: "Esta entrega já foi aceita por outro motoboy." };

        await db.update(deliveries)
            .set({
                motoboyId: me.id,
                status: "assigned",
                acceptedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .where(and(eq(deliveries.id, id), eq(deliveries.status, "pending")));

        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[ACCEPT ERROR]", e);
        return { error: "Erro ao aceitar entrega." };
    }
}

export async function pickupDeliveryAction(id: number) {
    const auth = await getAuthUserWithRole(["motoboy", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido" };

    try {
        const delivery = await db.query.deliveries.findFirst({
            where: and(
                eq(deliveries.id, id),
                eq(deliveries.motoboyId, me.id),
                eq(deliveries.status, "assigned")
            ),
        });

        if (!delivery) return { error: "Entrega não encontrada ou não atribuída a você." };

        await db.update(deliveries)
            .set({
                status: "picked_up",
                pickedUpAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .where(eq(deliveries.id, id));

        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[PICKUP ERROR]", e);
        return { error: "Erro ao marcar coleta." };
    }
}

export async function completeDeliveryAction(id: number) {
    const auth = await getAuthUserWithRole(["motoboy", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido" };

    try {
        const delivery = await db.query.deliveries.findFirst({
            where: and(
                eq(deliveries.id, id),
                eq(deliveries.motoboyId, me.id),
                inArray(deliveries.status, ["assigned", "picked_up"])
            ),
            with: { shopkeeper: true },
        });

        if (!delivery) {
            const alreadyDelivered = await db.query.deliveries.findFirst({
                where: and(
                    eq(deliveries.id, id),
                    eq(deliveries.motoboyId, me.id),
                    eq(deliveries.status, "delivered")
                ),
            });
            if (alreadyDelivered) return { success: true, alreadyDelivered: true };
            return { error: "Entrega não atribuída a você ou em status inválido." };
        }

        const shopId = delivery.shopkeeperId;
        let fee = 0;

        if (shopId) {
            const settings = await db.query.shopSettings.findFirst({
                where: eq(shopSettings.userId, shopId),
            });

            if (settings) {
                if (settings.remunerationModel === "fixed" || settings.remunerationModel === "hybrid") {
                    fee = settings.fixedValue || 0;
                }
            }
        }

        const existingTransaction = await db.query.transactions.findFirst({
            where: eq(transactions.relatedDeliveryId, id),
        });

        if (!existingTransaction && fee > 0) {
            await db.insert(transactions).values({
                userId: me.id,
                amount: fee,
                type: "credit",
                description: `Corrida #${id} - ${delivery.customerName || "Cliente"}`,
                relatedDeliveryId: id,
                creatorId: shopId,
                status: "confirmed",
            });
        }

        await db.update(deliveries)
            .set({
                status: "delivered",
                fee,
                deliveredAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .where(eq(deliveries.id, id));

        revalidatePath("/app");

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://zapentregas.duckdns.org";
        return {
            success: true,
            reviewUrl: `${baseUrl}/review/${id}`,
            customerPhone: delivery.customerPhone,
            customerName: delivery.customerName || "Cliente",
        };
    } catch (e) {
        console.error("[COMPLETE ERROR]", e);
        return { error: "Erro ao finalizar" };
    }
}
