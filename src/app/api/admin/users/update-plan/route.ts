import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserWithRole } from "@/lib/session";

const VALID_PLANS = ["free", "basic", "pro", "growth", "enterprise"] as const;

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUserWithRole("admin");
        if ("error" in auth) {
            return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
        }

        const { userId, plan } = await request.json();

        if (!Number.isInteger(userId) || userId <= 0 || !plan) {
            return NextResponse.json({ success: false, error: "userId e plan são obrigatórios" }, { status: 400 });
        }

        if (!VALID_PLANS.includes(plan)) {
            return NextResponse.json({ success: false, error: "Plano inválido" }, { status: 400 });
        }

        await db.update(users).set({
            plan,
            isTrialUser: false,
        }).where(eq(users.id, userId));

        return NextResponse.json({ success: true, message: "Plano alterado com sucesso" });
    } catch (error: any) {
        console.error("Erro ao alterar plano:", error);
        return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
    }
}
