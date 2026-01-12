import { db } from "@/db";
import { masterProducts, masterEvents } from "@/db/schema";
import { eq, desc, and, gte, sql, count, sum } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_KEY = process.env.MASTER_ADMIN_KEY || "admin_master_secret_key";

// GET: Estatísticas consolidadas de todos os produtos
export async function GET(request: NextRequest) {
    try {
        const adminKey = request.headers.get("X-ADMIN-KEY");
        const apiKey = request.headers.get("X-API-KEY");
        const { searchParams } = new URL(request.url);
        const period = searchParams.get("period") || "30d";

        // Aceita admin key OU api key de produto específico
        let productFilter: any = undefined;

        if (apiKey) {
            const product = await db.query.masterProducts.findFirst({
                where: eq(masterProducts.apiKey, apiKey)
            });
            if (!product) {
                return NextResponse.json({ success: false, error: "Produto não encontrado" }, { status: 401 });
            }
            productFilter = product.id;
        } else if (adminKey !== ADMIN_KEY) {
            return NextResponse.json({ success: false, error: "Chave inválida" }, { status: 401 });
        }

        // Calcular data limite baseado no período
        const days = parseInt(period.replace("d", "")) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString();

        // Buscar todos os produtos (ou filtrado)
        const products = productFilter
            ? await db.select().from(masterProducts).where(eq(masterProducts.id, productFilter))
            : await db.select().from(masterProducts);

        // Estatísticas gerais
        const stats = {
            period: `${days} dias`,
            totalProducts: products.length,
            products: [] as any[],
            totals: {
                revenue: 0,
                signups: 0,
                purchases: 0,
                cancellations: 0,
                errors: 0,
            }
        };

        // Buscar eventos por produto
        for (const product of products) {
            const productEvents = await db.select()
                .from(masterEvents)
                .where(and(
                    eq(masterEvents.productId, product.id),
                    gte(masterEvents.createdAt, startDateStr)
                ));

            const productStats = {
                id: product.id,
                name: product.name,
                type: product.type,
                revenue: 0,
                signups: 0,
                purchases: 0,
                cancellations: 0,
                errors: 0,
            };

            for (const event of productEvents) {
                switch (event.event) {
                    case "signup":
                        productStats.signups++;
                        stats.totals.signups++;
                        break;
                    case "purchase":
                        productStats.purchases++;
                        productStats.revenue += event.amount || 0;
                        stats.totals.purchases++;
                        stats.totals.revenue += event.amount || 0;
                        break;
                    case "cancel":
                        productStats.cancellations++;
                        stats.totals.cancellations++;
                        break;
                    case "error":
                        productStats.errors++;
                        stats.totals.errors++;
                        break;
                }
            }

            stats.products.push(productStats);
        }

        return NextResponse.json({
            success: true,
            stats,
        });

    } catch (error: any) {
        console.error("Erro ao buscar estatísticas:", error);
        return NextResponse.json(
            { success: false, error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}
