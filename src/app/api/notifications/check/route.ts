import { db } from "@/db";
import { deliveries, users } from "@/db/schema";
import { eq, and, gt, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const lastCheck = searchParams.get("lastCheck");

    if (!userId) {
        return NextResponse.json({ notifications: [] });
    }

    const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
    });

    if (!user) {
        return NextResponse.json({ notifications: [] });
    }

    const notifications: { title: string; body: string; icon?: string }[] = [];
    const lastCheckTime = lastCheck ? new Date(Number(lastCheck)) : new Date(Date.now() - 30000);

    if (user.role === "motoboy") {
        // Check for new pending deliveries (criadas recentemente)
        const newDeliveries = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.status, "pending"),
                gt(deliveries.createdAt, lastCheckTime.toISOString())
            ),
            with: { shopkeeper: true },
            limit: 10
        });

        // Notificação individual para cada nova entrega
        for (const delivery of newDeliveries) {
            const shopName = delivery.shopkeeper?.name || "Loja";
            const value = delivery.value ? `R$ ${delivery.value.toFixed(2)}` : "";
            const fee = delivery.fee ? ` (ganho: R$ ${delivery.fee.toFixed(2)})` : "";

            notifications.push({
                title: "🏍️ Nova Corrida Disponível!",
                body: `${shopName}: ${delivery.customerName || "Cliente"} - ${delivery.address.substring(0, 50)}${delivery.address.length > 50 ? "..." : ""} ${value}${fee}`,
            });
        }

        // Se houver muitas entregas novas, consolidar em uma notificação
        if (newDeliveries.length >= 3) {
            notifications.unshift({
                title: "🔥 Várias Corridas Disponíveis!",
                body: `${newDeliveries.length} novas entregas aguardando. Corra e garanta a sua!`,
            });
        }

        // Também checar total de entregas pendentes para lembrete
        const allPending = await db.query.deliveries.findMany({
            where: eq(deliveries.status, "pending"),
            limit: 20
        });

        // Se tiver entregas pendentes mas nenhuma nova, ainda assim notificar
        if (newDeliveries.length === 0 && allPending.length > 0) {
            // Notificar apenas a cada 5 minutos sobre entregas existentes
            const fiveMinutesAgo = new Date(Date.now() - 300000);
            if (lastCheckTime < fiveMinutesAgo) {
                notifications.push({
                    title: "📍 Entregas Aguardando",
                    body: `${allPending.length} entrega${allPending.length > 1 ? "s" : ""} disponíve${allPending.length > 1 ? "is" : "l"} agora!`,
                });
            }
        }
    } else if (user.role === "shopkeeper" || user.role === "admin") {
        // Check for delivered orders
        const deliveredOrders = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.shopkeeperId, user.id),
                eq(deliveries.status, "delivered"),
                gt(deliveries.updatedAt, lastCheckTime.toISOString())
            ),
            with: { motoboy: true },
            limit: 5
        });

        for (const order of deliveredOrders) {
            notifications.push({
                title: "✅ Pedido Entregue!",
                body: `Entrega #${order.id} foi concluída${order.motoboy ? ` por ${order.motoboy.name}` : ""}`,
            });
        }

        // Check for accepted orders (assigned status)
        const acceptedOrders = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.shopkeeperId, user.id),
                eq(deliveries.status, "assigned"),
                gt(deliveries.updatedAt, lastCheckTime.toISOString())
            ),
            with: { motoboy: true },
            limit: 5
        });

        for (const order of acceptedOrders) {
            notifications.push({
                title: "📦 Entrega Aceita!",
                body: `${order.motoboy?.name || "Motoboy"} aceitou a entrega #${order.id}`,
            });
        }

        // Check for orders picked up (in route)
        const pickedUpOrders = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.shopkeeperId, user.id),
                eq(deliveries.status, "picked_up"),
                gt(deliveries.updatedAt, lastCheckTime.toISOString())
            ),
            with: { motoboy: true },
            limit: 5
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
