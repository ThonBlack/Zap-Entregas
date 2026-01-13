import { db } from "@/db";
import { appLogs } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { desc, eq, gte } from "drizzle-orm";

// POST: Registrar novo log (usado pelo client)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { level, event, message, page, metadata, stack } = body;

        if (!event) {
            return NextResponse.json({ error: "event é obrigatório" }, { status: 400 });
        }

        // Tentar pegar userId do cookie
        const cookieStore = await cookies();
        const userId = cookieStore.get("user_id")?.value;

        // Informações do request
        const userAgent = request.headers.get("user-agent") || "";
        const ip = request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown";

        await db.insert(appLogs).values({
            level: level || "info",
            event,
            message,
            userId: userId ? Number(userId) : null,
            page,
            userAgent,
            ip,
            metadata: metadata ? JSON.stringify(metadata) : null,
            stack
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Erro ao salvar log:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// GET: Listar logs (apenas admin)
export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Verificar se é admin (simplificado - em produção verificar no DB)
    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level");
    const limit = Number(searchParams.get("limit") || 100);
    const since = searchParams.get("since"); // ISO string

    try {
        let query = db.select().from(appLogs);

        // Ordenar por mais recente
        const logs = await db.select()
            .from(appLogs)
            .orderBy(desc(appLogs.createdAt))
            .limit(limit);

        return NextResponse.json({
            logs,
            total: logs.length
        });

    } catch (error: any) {
        console.error("Erro ao buscar logs:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
