import { db } from "@/db";
import { deliveries, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/**
 * API de Integração para PDV
 * 
 * POST /api/integration/delivery
 * 
 * Headers:
 *   X-API-KEY: sua-api-key
 * 
 * Body (JSON):
 * {
 *   "customerName": "Nome do Cliente",
 *   "customerPhone": "11999999999",
 *   "address": "Rua Exemplo, 123 - Bairro - Cidade",
 *   "value": 50.00,           // Valor do pedido (opcional)
 *   "fee": 10.00,             // Taxa de entrega (opcional)
 *   "observation": "Obs..."   // Observação (opcional)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "deliveryId": 123,
 *   "trackingUrl": "https://zapentregas.duckdns.org/tracking/123"
 * }
 */

export async function POST(request: NextRequest) {
    try {
        // Verificar API Key
        const apiKey = request.headers.get("X-API-KEY");

        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: "API Key não fornecida" },
                { status: 401 }
            );
        }

        // Buscar usuário pela API Key
        let user;

        // Novo formato: zap_{userId}_{hash} - busca direto no banco
        if (apiKey.startsWith("zap_")) {
            user = await db.query.users.findFirst({
                where: and(
                    eq(users.apiKey, apiKey),
                    eq(users.role, "shopkeeper")
                )
            });
        }
        // Formato legado: apikey_{userId}_{phone}
        else if (apiKey.startsWith("apikey_")) {
            const keyParts = apiKey.split("_");
            if (keyParts.length >= 3) {
                const userId = parseInt(keyParts[1]);
                user = await db.query.users.findFirst({
                    where: and(
                        eq(users.id, userId),
                        eq(users.role, "shopkeeper")
                    )
                });
            }
        }

        if (!user) {
            return NextResponse.json(
                { success: false, error: "API Key inválida ou lojista não encontrado" },
                { status: 401 }
            );
        }

        // Validar e extrair dados do corpo
        const body = await request.json();

        if (!body.address) {
            return NextResponse.json(
                { success: false, error: "Endereço é obrigatório" },
                { status: 400 }
            );
        }

        // Criar a entrega
        const newDelivery = await db.insert(deliveries).values({
            shopkeeperId: user.id,
            customerName: body.customerName || null,
            customerPhone: body.customerPhone || null,
            address: body.address,
            value: body.value || 0,
            fee: body.fee || 0,
            observation: body.observation || null,
            status: "pending",
        }).returning().get();

        // URL base para rastreamento
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://zapentregas.duckdns.org";

        return NextResponse.json({
            success: true,
            deliveryId: newDelivery.id,
            trackingUrl: `${baseUrl}/tracking/${newDelivery.id}`,
            message: "Entrega criada com sucesso! Os motoboys serão notificados."
        });

    } catch (error: any) {
        console.error("Erro na API de integração:", error);
        return NextResponse.json(
            { success: false, error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}

// GET para verificar status de uma entrega
export async function GET(request: NextRequest) {
    const apiKey = request.headers.get("X-API-KEY");
    const { searchParams } = new URL(request.url);
    const deliveryId = searchParams.get("id");

    if (!apiKey) {
        return NextResponse.json({ success: false, error: "API Key não fornecida" }, { status: 401 });
    }

    if (!deliveryId) {
        return NextResponse.json({ success: false, error: "ID da entrega não fornecido" }, { status: 400 });
    }

    const keyParts = apiKey.split("_");
    if (keyParts.length < 3 || keyParts[0] !== "apikey") {
        return NextResponse.json({ success: false, error: "API Key inválida" }, { status: 401 });
    }

    const userId = parseInt(keyParts[1]);

    const delivery = await db.query.deliveries.findFirst({
        where: and(
            eq(deliveries.id, parseInt(deliveryId)),
            eq(deliveries.shopkeeperId, userId)
        ),
        with: { motoboy: true }
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
                phone: delivery.motoboy.phone
            } : null,
            createdAt: delivery.createdAt,
            updatedAt: delivery.updatedAt
        }
    });
}
