import { db } from "@/db";
import { appLogs } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getAuthUser, getAuthUserWithRole } from "@/lib/session";

const VALID_LEVELS = ["info", "warn", "error", "debug"] as const;
type LogLevel = typeof VALID_LEVELS[number];

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUser();
        if ("error" in auth) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }

        const body = await request.json();
        const { level, event, message, page, metadata, stack } = body || {};

        if (!event || typeof event !== "string") {
            return NextResponse.json({ error: "event é obrigatório" }, { status: 400 });
        }

        const safeLevel: LogLevel =
            typeof level === "string" && (VALID_LEVELS as readonly string[]).includes(level)
                ? (level as LogLevel)
                : "info";

        const userAgent = (request.headers.get("user-agent") || "").slice(0, 500);
        const ip = (request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown").slice(0, 100);

        await db.insert(appLogs).values({
            level: safeLevel,
            event: event.slice(0, 200),
            message: typeof message === "string" ? message.slice(0, 2000) : null,
            userId: auth.user.id,
            page: typeof page === "string" ? page.slice(0, 200) : null,
            userAgent,
            ip,
            metadata: metadata ? JSON.stringify(metadata).slice(0, 4000) : null,
            stack: typeof stack === "string" ? stack.slice(0, 4000) : null,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Erro ao salvar log:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) {
        return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

    try {
        const logs = await db.select()
            .from(appLogs)
            .orderBy(desc(appLogs.createdAt))
            .limit(limit);

        return NextResponse.json({ logs, total: logs.length });
    } catch (error: any) {
        console.error("Erro ao buscar logs:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
