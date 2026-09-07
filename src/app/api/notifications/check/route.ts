import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { formatBRL } from "@/lib/wallet-shared";

export async function GET(request: NextRequest) {
    const auth = await getAuthUser();
    if ("error" in auth) {
        return NextResponse.json({ notifications: [] }, { status: 401 });
    }
    const user = auth.user;

    const { searchParams } = new URL(request.url);
    const lastCheck = searchParams.get("lastCheck");

    // `tag` = marca do aviso. Fixa por corrida ("corrida-12"): dois avisos da mesma
    // corrida se substituem em vez de encher a gaveta de notificação do celular.
    const notifications: { title: string; body: string; icon?: string; tag?: string }[] = [];

    // `lastCheck=abc` virava NaN → `new Date(NaN).toISOString()` lança e a rota
    // devolvia 500, matando as notificações do motoboy em silêncio. Valor que
    // não for número cai no padrão de 30 segundos.
    const marca = Number(lastCheck);
    const lastCheckTime = Number.isFinite(marca) && marca > 0
        ? new Date(marca)
        : new Date(Date.now() - 30000);
    // As comparações passam por `datetime()` no SQL: as datas do banco convivem
    // em dois formatos e comparar texto direto nunca dava verdadeiro.
    const desdeIso = lastCheckTime.toISOString();

    if (user.role === "motoboy") {
        const newDeliveries = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.status, "pending"),
                sql`datetime(${deliveries.createdAt}) > datetime(${desdeIso})`
            ),
            with: { shopkeeper: true },
            limit: 10,
        });

        for (const delivery of newDeliveries) {
            const shopName = delivery.shopkeeper?.name || "Loja";
            // formatBRL: antes saía "R$ 180.00" com ponto na tela de bloqueio.
            const value = delivery.value ? formatBRL(delivery.value) : "";
            const fee = delivery.fee ? ` (ganho: ${formatBRL(delivery.fee)})` : "";

            notifications.push({
                title: "🏍️ Nova Corrida Disponível!",
                body: `${shopName}: ${delivery.customerName || "Cliente"} - ${delivery.address.substring(0, 50)}${delivery.address.length > 50 ? "..." : ""} ${value}${fee}`,
                tag: `corrida-${delivery.id}`,
            });
        }

        if (newDeliveries.length >= 3) {
            notifications.unshift({
                tag: "corridas-varias",
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
                    tag: "corridas-aguardando",
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
                sql`datetime(${deliveries.updatedAt}) > datetime(${desdeIso})`
            ),
            with: { motoboy: true },
            limit: 5,
        });

        for (const order of deliveredOrders) {
            notifications.push({
                title: "✅ Pedido Entregue!",
                body: `Entrega #${order.id} foi concluída${order.motoboy ? ` por ${order.motoboy.name}` : ""}`,
                tag: `corrida-${order.id}`,
            });
        }

        const acceptedOrders = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.shopkeeperId, user.id),
                eq(deliveries.status, "assigned"),
                sql`datetime(${deliveries.updatedAt}) > datetime(${desdeIso})`
            ),
            with: { motoboy: true },
            limit: 5,
        });

        for (const order of acceptedOrders) {
            notifications.push({
                title: "📦 Entrega Aceita!",
                body: `${order.motoboy?.name || "Motoboy"} aceitou a entrega #${order.id}`,
                tag: `corrida-${order.id}`,
            });
        }

        const pickedUpOrders = await db.query.deliveries.findMany({
            where: and(
                eq(deliveries.shopkeeperId, user.id),
                eq(deliveries.status, "picked_up"),
                sql`datetime(${deliveries.updatedAt}) > datetime(${desdeIso})`
            ),
            with: { motoboy: true },
            limit: 5,
        });

        for (const order of pickedUpOrders) {
            notifications.push({
                title: "🏍️ Saiu para Entrega!",
                body: `${order.motoboy?.name || "Motoboy"} está a caminho com a entrega #${order.id}`,
                tag: `corrida-${order.id}`,
            });
        }
    }

    return NextResponse.json({ notifications });
}
