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

        const { userId, status } = await request.json();

        if (!userId || !status) {
            return NextResponse.json({ success: false, error: "userId e status são obrigatórios" }, { status: 400 });
        }

        if (!['active', 'inactive', 'trial'].includes(status)) {
            return NextResponse.json({ success: false, error: "Status inválido" }, { status: 400 });
        }

        await db.update(users).set({
            subscriptionStatus: status
        }).where(eq(users.id, userId));

        return NextResponse.json({ success: true, message: `Usuário ${status === 'active' ? 'reativado' : 'suspenso'} com sucesso` });

    } catch (error: any) {
        console.error("Erro ao alterar status:", error);
        return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
    }
}
