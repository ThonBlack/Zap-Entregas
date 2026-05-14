import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserWithRole } from "@/lib/session";

const VALID_STATUS = ["active", "inactive", "trial"] as const;

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUserWithRole("admin");
        if ("error" in auth) {
            return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
        }

        const { userId, status } = await request.json();

        if (!Number.isInteger(userId) || userId <= 0 || !status) {
            return NextResponse.json({ success: false, error: "userId e status são obrigatórios" }, { status: 400 });
        }

        if (!VALID_STATUS.includes(status)) {
            return NextResponse.json({ success: false, error: "Status inválido" }, { status: 400 });
        }

        await db.update(users).set({
            subscriptionStatus: status,
        }).where(eq(users.id, userId));

        return NextResponse.json({ success: true, message: `Usuário ${status === "active" ? "reativado" : "suspenso"} com sucesso` });
    } catch (error: any) {
        console.error("Erro ao alterar status:", error);
        return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
    }
}
