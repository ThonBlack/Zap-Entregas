import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const currentUserId = cookieStore.get("user_id")?.value;

        if (!currentUserId) {
            return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
        }

        const currentUser = await db.query.users.findFirst({
            where: eq(users.id, Number(currentUserId))
        });

        if (currentUser?.role !== "admin") {
            return NextResponse.json({ success: false, error: "Acesso negado" }, { status: 403 });
        }

        const { userId, plan } = await request.json();

        if (!userId || !plan) {
            return NextResponse.json({ success: false, error: "userId e plan são obrigatórios" }, { status: 400 });
        }

        if (!['free', 'basic', 'pro', 'growth', 'enterprise'].includes(plan)) {
            return NextResponse.json({ success: false, error: "Plano inválido" }, { status: 400 });
        }

        await db.update(users).set({
            plan,
            isTrialUser: false, // Remove trial ao alterar plano manualmente
        }).where(eq(users.id, userId));

        return NextResponse.json({ success: true, message: "Plano alterado com sucesso" });

    } catch (error: any) {
        console.error("Erro ao alterar plano:", error);
        return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
    }
}
