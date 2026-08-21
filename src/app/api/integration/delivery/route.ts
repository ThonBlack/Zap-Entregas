import { db } from "@/db";
import { deliveries, users, shopSettings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/routeUtils";
import { newTrackingToken } from "@/lib/trackingToken";
import { pushToDraftReviewers } from "@/lib/push";

/**
 * API de Integração para PDV
 *
 * Headers: X-API-KEY: zap_<userId>_<random>
 */

async function authenticateApiKey(apiKey: string | null) {
    if (!apiKey || !apiKey.startsWith("zap_")) return null;
    return db.query.users.findFirst({
        where: and(eq(users.apiKey, apiKey), eq(users.role, "shopkeeper")),
    });
}

export async function POST(request: NextRequest) {
    try {
        const apiKey = request.headers.get("X-API-KEY");
        const user = await authenticateApiKey(apiKey);

        if (!user) {
            return NextResponse.json(
                { success: false, error: "API Key inválida ou lojista não encontrado" },
                { status: 401 }
            );
        }

        const body = await request.json();

        if (!body.address || typeof body.address !== "string") {
            return NextResponse.json(
                { success: false, error: "Endereço é obrigatório" },
                { status: 400 }
            );
        }

        const value = Number.isFinite(body.value) ? body.value : 0;
        const fee = Number.isFinite(body.fee) ? body.fee : 0;
        const address = body.address.slice(0, 500);

        // Geocodificar já na criação (senão a entrega entra sem pin no mapa e sem geofence)
        let lat = 0, lng = 0;
        let geoPrecision: string | null = null;
        try {
            const s = await db.query.shopSettings.findFirst({
                where: eq(shopSettings.userId, user.id),
                columns: { defaultCity: true, defaultState: true, shopLat: true, shopLng: true },
            });
            const coords = await geocodeAddress(address, {
                defaultCity: s?.defaultCity ?? null,
                defaultState: s?.defaultState ?? null,
                shopLat: s?.shopLat ?? null,
                shopLng: s?.shopLng ?? null,
            });
            if (coords) { lat = coords.lat; lng = coords.lng; geoPrecision = coords.precision; }
        } catch (e) {
            console.error("[INTEGRATION] geocode falhou:", e);
        }

        const newDelivery = await db.insert(deliveries).values({
            shopkeeperId: user.id,
            customerName: typeof body.customerName === "string" ? body.customerName.slice(0, 200) : null,
            customerPhone: typeof body.customerPhone === "string" ? body.customerPhone.slice(0, 30) : null,
            address,
            lat,
            lng,
            value,
            fee,
            observation: typeof body.observation === "string" ? body.observation.slice(0, 1000) : null,
            geoPrecision,
            // Nasce rascunho: o lojista/admin confere endereço no mapa e libera pros motoboys.
            status: "draft",
            publicToken: newTrackingToken(),
        }).returning().get();

        // Quem é avisado agora é quem libera, não o motoboy.
        pushToDraftReviewers(user.id, {
            title: "📦 Corrida do PDV esperando confirmação",
            body: address,
            url: `/deliveries/${newDelivery.id}/confirmar`,
            tag: `confirmar-${newDelivery.id}`,
        }).catch(() => { });

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://zapentregas.duckdns.org";

        return NextResponse.json({
            success: true,
            deliveryId: newDelivery.id,
            trackingUrl: `${baseUrl}/tracking/${newDelivery.publicToken}`,
            status: newDelivery.status,
            message: "Entrega registrada! Aguardando confirmação do endereço para liberar aos motoboys.",
        });
    } catch (error: any) {
        console.error("Erro na API de integração:", error);
        return NextResponse.json(
            { success: false, error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    const apiKey = request.headers.get("X-API-KEY");
    const user = await authenticateApiKey(apiKey);

    if (!user) {
        return NextResponse.json({ success: false, error: "API Key inválida" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deliveryId = Number(searchParams.get("id"));
    if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
        return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const delivery = await db.query.deliveries.findFirst({
        where: and(
            eq(deliveries.id, deliveryId),
            eq(deliveries.shopkeeperId, user.id)
        ),
        with: { motoboy: true },
    });

    if (!delivery) {
        return NextResponse.json({ success: false, error: "Entrega não encontrada" }, { status: 404 });
    }

    return NextResponse.json({
        success: true,
        delivery: {
            id: delivery.id,
            status: delivery.status,
            customerName: delivery.customerName,
            address: delivery.address,
            motoboy: delivery.motoboy ? {
                name: delivery.motoboy.name,
                phone: delivery.motoboy.phone,
            } : null,
            createdAt: delivery.createdAt,
            updatedAt: delivery.updatedAt,
        },
    });
}
