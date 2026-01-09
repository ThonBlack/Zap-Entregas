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
        // Check for new pending deliveries
        const newDeliveries = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.status, "pending"),
                gt(deliveries.createdAt, lastCheckTime.toISOString())
            ),
            limit: 5
        });

        for (const delivery of newDeliveries) {
            notifications.push({
                title: "🏍️ Nova Corrida Disponível!",
                body: `${delivery.address} - R$ ${(delivery.fee || 0).toFixed(2)}`,
            });
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
    }

    return NextResponse.json({ notifications });
}
