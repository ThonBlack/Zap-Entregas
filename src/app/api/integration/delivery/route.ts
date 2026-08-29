import { db } from "@/db";
import { deliveries, users, shopSettings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/routeUtils";
import { newTrackingToken, newConfirmToken, confirmTokenExpiry } from "@/lib/trackingToken";
import { pushToDraftReviewers } from "@/lib/push";
import { parseMoney } from "@/lib/money";

/**
 * API de Integração para PDV
 *
 * Headers: X-API-KEY: zap_<userId>_<random>
 */

/** Campo de texto do corpo da requisição, aparado e limitado. */
function str(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null;
}

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

        // O PDV é código de terceiro: corpo quebrado tem que voltar 400 explicando,
        // e não 500 "erro interno" (que manda o caixa ligar pro suporte à toa).
        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { success: false, error: "JSON inválido" },
                { status: 400 }
            );
        }
        if (!body || typeof body !== "object") {
            return NextResponse.json(
                { success: false, error: "JSON inválido" },
                { status: 400 }
            );
        }

        // Endereço só com espaço é o mesmo que endereço em branco.
        const address = typeof body.address === "string" ? body.address.trim().slice(0, 500) : "";
        if (!address) {
            return NextResponse.json(
                { success: false, error: "Endereço é obrigatório" },
                { status: 400 }
            );
        }

        // O PDV manda o valor como o Brasil escreve ("12,50"). Number("12,50") é
        // NaN e a corrida entrava valendo zero sem ninguém perceber.
        let value = 0;
        if (body.value !== undefined && body.value !== null && body.value !== "") {
            const parsed = parseMoney(body.value);
            if (parsed === null) {
                return NextResponse.json(
                    { success: false, error: "Valor inválido. Use 12.50 ou \"12,50\"." },
                    { status: 400 }
                );
            }
            if (parsed < 0) {
                return NextResponse.json(
                    { success: false, error: "Valor não pode ser negativo" },
                    { status: 400 }
                );
            }
            value = parsed;
        }

        // O PDV às vezes manda "fee" achando que define o ganho do motoboy. Não
        // define (ver abaixo) — então avisamos na resposta em vez de ignorar calado.
        const feeIgnored = body.fee !== undefined && body.fee !== null && body.fee !== "";

        // Geocodificar já na criação (senão a entrega entra sem pin no mapa e sem geofence)
        let lat = 0, lng = 0;
        let geoPrecision: string | null = null;
        try {
            const s = await db.query.shopSettings.findFirst({
                where: eq(shopSettings.userId, user.id),
                columns: { defaultCity: true, defaultState: true, shopLat: true, shopLng: true },
            });
            // O PDV pode mandar o endereço já separado (street, number, ...) — quando
            // manda, o ponto sai bem mais preciso do que interpretando a frase.
            const partes = typeof body.addressParts === "object" && body.addressParts
                ? {
                    street: str(body.addressParts.street),
                    number: str(body.addressParts.number),
                    neighborhood: str(body.addressParts.neighborhood),
                    city: str(body.addressParts.city),
                    state: str(body.addressParts.state),
                    cep: str(body.addressParts.cep),
                }
                : null;

            const coords = await geocodeAddress(address, {
                defaultCity: s?.defaultCity ?? null,
                defaultState: s?.defaultState ?? null,
                shopLat: s?.shopLat ?? null,
                shopLng: s?.shopLng ?? null,
            }, partes);
            if (coords) { lat = coords.lat; lng = coords.lng; geoPrecision = coords.precision; }
        } catch (e) {
            console.error("[INTEGRATION] geocode falhou:", e);
        }

        // "fee" aqui é o que o MOTOBOY ganha (contrato da tela de conferência), não o
        // frete que o PDV cobra do cliente — por isso body.fee é ignorado. Nasce da
        // regra da loja e o lojista pode ajustar na conferência.
        let fee = 0;
        try {
            const remu = await db.query.shopSettings.findFirst({
                where: eq(shopSettings.userId, user.id),
                columns: { remunerationModel: true, fixedValue: true },
            });
            if (remu && (remu.remunerationModel === "fixed" || remu.remunerationModel === "hybrid")) {
                fee = remu.fixedValue || 0;
            }
        } catch { /* sem regra, taxa fica 0 e o lojista preenche na conferência */ }

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
            confirmToken: newConfirmToken(),
            confirmTokenExpiresAt: confirmTokenExpiry(),
        }).returning().get();

        // Quem é avisado agora é quem libera, não o motoboy.
        pushToDraftReviewers(user.id, {
            title: "📦 Corrida do PDV esperando confirmação",
            body: address,
            url: `/deliveries/${newDelivery.id}/confirmar`,
            tag: `confirmar-${newDelivery.id}`,
        }).catch(() => { });

        const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://zapentregas.duckdns.org";

        return NextResponse.json({
            success: true,
            deliveryId: newDelivery.id,
            // Avisa o PDV que o "fee" que ele mandou não foi usado.
            ...(feeIgnored ? { feeIgnored: true } : {}),
            trackingUrl: `${baseUrl}/tracking/${newDelivery.publicToken}`,
            // O PDV abre isto numa janela por cima da venda pra conferir o endereço na hora.
            confirmUrl: `${baseUrl}/confirmar/${newDelivery.confirmToken}`,
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
