import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";

export async function GET(request: NextRequest) {
    const auth = await getAuthUser();
    if ("error" in auth) {
        return NextResponse.json({ notifications: [] }, { status: 401 });
    }
    const user = auth.user;

    const { searchParams } = new URL(request.url);
    const lastCheck = searchParams.get("lastCheck");

    const notifications: { title: string; body: string; icon?: string }[] = [];
    const lastCheckTime = lastCheck ? new Date(Number(lastCheck)) : new Date(Date.now() - 30000);

    if (user.role === "motoboy") {
        const newDeliveries = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.status, "pending"),
                gt(deliveries.createdAt, lastCheckTime.toISOString())
            ),
            with: { shopkeeper: true },
            limit: 10,
        });

        for (const delivery of newDeliveries) {
            const shopName = delivery.shopkeeper?.name || "Loja";
            const value = delivery.value ? `R$ ${delivery.value.toFixed(2)}` : "";
            const fee = delivery.fee ? ` (ganho: R$ ${delivery.fee.toFixed(2)})` : "";

            notifications.push({
                title: "🏍️ Nova Corrida Disponível!",
                body: `${shopName}: ${delivery.customerName || "Cliente"} - ${delivery.address.substring(0, 50)}${delivery.address.length > 50 ? "..." : ""} ${value}${fee}`,
            });
        }

        if (newDeliveries.length >= 3) {
            notifications.unshift({
                title: "🔥 Várias Corridas Disponíveis!",
                body: `${newDeliveries.length} novas entregas aguardando. Corra e garanta a sua!`,
            });
        }

        const allPending = await db.query.deliveries.findMany({
            where: eq(deliveries.status, "pending"),
            limit: 20,
        });

        if (newDeliveries.length === 0 && allPending.length > 0) {
            const fiveMinutesAgo = new Date(Date.now() - 300000);
            if (lastCheckTime < fiveMinutesAgo) {
                notifications.push({
                    title: "📍 Entregas Aguardando",
                    body: `${allPending.length} entrega${allPending.length > 1 ? "s" : ""} disponíve${allPending.length > 1 ? "is" : "l"} agora!`,
                });
            }
        }
    } else if (user.role === "shopkeeper" || user.role === "admin") {
        const deliveredOrders = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.shopkeeperId, user.id),
                eq(deliveries.status, "delivered"),
                gt(deliveries.updatedAt, lastCheckTime.toISOString())
            ),
            with: { motoboy: true },
            limit: 5,
        });

        for (const order of deliveredOrders) {
            notifications.push({
                title: "✅ Pedido Entregue!",
                body: `Entrega #${order.id} foi concluída${order.motoboy ? ` por ${order.motoboy.name}` : ""}`,
            });
        }

        const acceptedOrders = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.shopkeeperId, user.id),
                eq(deliveries.status, "assigned"),
                gt(deliveries.updatedAt, lastCheckTime.toISOString())
            ),
            with: { motoboy: true },
            limit: 5,
        });

        for (const order of acceptedOrders) {
            notifications.push({
                title: "📦 Entrega Aceita!",
                body: `${order.motoboy?.name || "Motoboy"} aceitou a entrega #${order.id}`,
            });
        }

        const pickedUpOrders = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.shopkeeperId, user.id),
                eq(deliveries.status, "picked_up"),
                gt(deliveries.updatedAt, lastCheckTime.toISOString())
            ),
            with: { motoboy: true },
            limit: 5,
        });

        for (const order of pickedUpOrders) {
            notifications.push({
                title: "🏍️ Saiu para Entrega!",
                body: `${order.motoboy?.name || "Motoboy"} está a caminho com a entrega #${order.id}`,
            });
        }
    }

    return NextResponse.json({ notifications });
}
