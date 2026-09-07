import { db } from "@/db";
import { masterProducts, masterEvents } from "@/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/**
 * Tetos desta rota.
 *
 * O banco é um arquivo SQLite só, o mesmo do app inteiro: um "metadata" de 50 MB
 * gravado aqui engorda o arquivo que a operação de entregas usa, e um
 * "?limit=99999999" puxa a coleção toda pra memória do processo. A rota de logs
 * (/api/logs) já corta desse jeito — aqui faltava.
 */
const MAX_EVENTOS_POR_PAGINA = 500;
const MAX_METADATA = 4000;

/** Os únicos tipos que o banco aceita nesta coluna. */
const EVENTOS = ["signup", "login", "purchase", "cancel", "refund", "error", "custom"] as const;
type TipoDeEvento = (typeof EVENTOS)[number];

/** Texto do corpo da requisição, aparado e com teto. */
function corte(v: unknown, max: number): string | null {
    if (typeof v === "string") { const t = v.trim(); return t ? t.slice(0, max) : null; }
    if (typeof v === "number" && Number.isFinite(v)) return String(v).slice(0, max);
    return null;
}

// POST: Registrar evento de um produto
export async function POST(request: NextRequest) {
    try {
        const apiKey = request.headers.get("X-API-KEY");

        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: "API Key não fornecida" },
                { status: 401 }
            );
        }

        // Buscar produto pela API Key
        const product = await db.query.masterProducts.findFirst({
            where: eq(masterProducts.apiKey, apiKey)
        });

        if (!product) {
            return NextResponse.json(
                { success: false, error: "Produto não encontrado" },
                { status: 401 }
            );
        }

        if (!product.isActive) {
            return NextResponse.json(
                { success: false, error: "Produto desativado" },
                { status: 403 }
            );
        }

        const body = await request.json();

        const eventoDigitado = corte(body.event, 40);
        if (!eventoDigitado || !EVENTOS.includes(eventoDigitado as TipoDeEvento)) {
            return NextResponse.json(
                { success: false, error: `Tipo de evento inválido. Use um destes: ${EVENTOS.join(", ")}.` },
                { status: 400 }
            );
        }
        const evento = eventoDigitado as TipoDeEvento;

        const metadata = body.metadata ? JSON.stringify(body.metadata).slice(0, MAX_METADATA) : null;
        const valor = typeof body.amount === "number" && Number.isFinite(body.amount) ? body.amount : null;

        const newEvent = await db.insert(masterEvents).values({
            productId: product.id,
            event: evento,
            userId: corte(body.userId, 64),
            amount: valor,
            currency: corte(body.currency, 8) || "BRL",
            metadata,
            createdAt: new Date().toISOString(),
        }).returning().get();

        return NextResponse.json({
            success: true,
            eventId: newEvent.id,
            message: "Evento registrado com sucesso!"
        });

    } catch (error: any) {
        console.error("Erro ao registrar evento:", error);
        return NextResponse.json(
            { success: false, error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}

// GET: Buscar eventos de um produto
export async function GET(request: NextRequest) {
    try {
        const apiKey = request.headers.get("X-API-KEY");
        const { searchParams } = new URL(request.url);
        // Teto no limite: sem ele um "?limit=99999999" puxa tudo de uma vez.
        const limitPedido = parseInt(searchParams.get("limit") || "50", 10);
        const limit = Number.isFinite(limitPedido) && limitPedido > 0
            ? Math.min(limitPedido, MAX_EVENTOS_POR_PAGINA)
            : 50;
        const eventType = searchParams.get("event");

        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: "API Key não fornecida" },
                { status: 401 }
            );
        }

        const product = await db.query.masterProducts.findFirst({
            where: eq(masterProducts.apiKey, apiKey)
        });

        if (!product) {
            return NextResponse.json(
                { success: false, error: "Produto não encontrado" },
                { status: 401 }
            );
        }

        let query = db.select()
            .from(masterEvents)
            .where(eq(masterEvents.productId, product.id))
            .orderBy(desc(masterEvents.createdAt))
            .limit(limit);

        const events = await query;

        return NextResponse.json({
            success: true,
            product: { id: product.id, name: product.name },
            events: events.map(e => ({
                ...e,
                metadata: e.metadata ? JSON.parse(e.metadata) : null
            })),
        });

    } catch (error: any) {
        console.error("Erro ao buscar eventos:", error);
        return NextResponse.json(
            { success: false, error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}
