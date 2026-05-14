import { db } from "@/db";
import { masterProducts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function requireMasterAdminKey(provided: string | null): boolean {
    const expected = process.env.MASTER_ADMIN_KEY;
    if (!expected || expected.length < 16) {
        console.error("[MASTER] MASTER_ADMIN_KEY ausente ou fraca — rejeitando requisição.");
        return false;
    }
    if (!provided) return false;
    if (provided.length !== expected.length) return false;
    return Buffer.from(provided).equals(Buffer.from(expected));
}

// POST: Registrar novo produto
export async function POST(request: NextRequest) {
    try {
        if (!requireMasterAdminKey(request.headers.get("X-ADMIN-KEY"))) {
            return NextResponse.json(
                { success: false, error: "Chave admin inválida" },
                { status: 401 }
            );
        }

        const body = await request.json();

        if (!body.name || !body.type) {
            return NextResponse.json(
                { success: false, error: "Nome e tipo são obrigatórios" },
                { status: 400 }
            );
        }

        // Gerar API Key única para o produto
        const randomBytes = new Uint8Array(24);
        crypto.getRandomValues(randomBytes);
        const randomHash = Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const apiKey = `master_${body.type}_${Date.now()}_${randomHash}`;

        const newProduct = await db.insert(masterProducts).values({
            name: body.name,
            type: body.type,
            description: body.description || null,
            packageName: body.packageName || null,
            webhookUrl: body.webhookUrl || null,
            apiKey,
        }).returning().get();

        return NextResponse.json({
            success: true,
            product: {
                id: newProduct.id,
                name: newProduct.name,
                type: newProduct.type,
                apiKey: newProduct.apiKey,
            },
            message: "Produto registrado com sucesso!"
        });

    } catch (error: any) {
        console.error("Erro ao registrar produto:", error);
        return NextResponse.json(
            { success: false, error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}

// GET: Listar todos os produtos
export async function GET(request: NextRequest) {
    try {
        if (!requireMasterAdminKey(request.headers.get("X-ADMIN-KEY"))) {
            return NextResponse.json(
                { success: false, error: "Chave admin inválida" },
                { status: 401 }
            );
        }

        const products = await db.select({
            id: masterProducts.id,
            name: masterProducts.name,
            type: masterProducts.type,
            description: masterProducts.description,
            isActive: masterProducts.isActive,
            createdAt: masterProducts.createdAt,
        }).from(masterProducts);

        return NextResponse.json({
            success: true,
            products,
        });

    } catch (error: any) {
        console.error("Erro ao listar produtos:", error);
        return NextResponse.json(
            { success: false, error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}
