import { db } from "@/db";
import { masterProducts, masterEvents } from "@/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

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

        if (!body.event) {
            return NextResponse.json(
                { success: false, error: "Tipo de evento é obrigatório" },
                { status: 400 }
            );
        }

        const newEvent = await db.insert(masterEvents).values({
            productId: product.id,
            event: body.event,
            userId: body.userId || null,
            amount: body.amount || null,
            currency: body.currency || "BRL",
            metadata: body.metadata ? JSON.stringify(body.metadata) : null,
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
        const limit = parseInt(searchParams.get("limit") || "50");
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
