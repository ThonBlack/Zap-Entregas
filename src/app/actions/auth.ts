"use server";

import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function loginAction(formData: FormData) {
    const phone = formData.get("phone") as string;
    const password = formData.get("password") as string;

    if (!phone || !password) {
        // In a real app we would return state to show error
        return { error: "Preencha todos os campos" };
    }

    // Simple query
    const user = await db.select().from(users).where(eq(users.phone, phone)).get();

    if (!user || user.password !== password) {
        return { error: "Credenciais inválidas" };
    }

    // Check 2FA
    if (user.twoFactorEnabled && user.twoFactorSecret) {
        // Set temporary 2FA cookie
        (await cookies()).set("2fa_pending_userId", user.id.toString(), {
            httpOnly: true,
            path: "/",
            maxAge: 60 * 5 // 5 minutes to verify
        });
        redirect("/login/2fa");
    }

    // Set cookie
    (await cookies()).set("user_id", user.id.toString(), {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    redirect("/");
}

// 2FA Actions
import { authenticator } from "otplib";

export async function verifyTwoFactorAction(token: string) {
    const cookieStore = await cookies();
    const pendingId = cookieStore.get("2fa_pending_userId")?.value;

    if (!pendingId) return { error: "Sessão expirada. Faça login novamente." };

    const user = await db.select().from(users).where(eq(users.id, Number(pendingId))).get();

    if (!user || !user.twoFactorSecret) return { error: "Erro de autenticação." };

    try {
        const isValid = authenticator.check(token, user.twoFactorSecret);
        if (!isValid) return { error: "Código inválido." };
    } catch (e) {
        return { error: "Erro ao validar código." };
    }

    // Success: Set real session
    cookieStore.delete("2fa_pending_userId");
    cookieStore.set("user_id", user.id.toString(), {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7
    });

    redirect("/");
}

export async function generateTwoFactorSecretAction() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    const secret = authenticator.generateSecret();
    const user = await db.query.users.findFirst({ where: eq(users.id, Number(userId)) });
    const otpauth = authenticator.keyuri(user?.phone || 'user', 'ZapEntregas', secret);

    return { secret, otpauth };
}

export async function enableTwoFactorAction(token: string, secret: string) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    const isValid = authenticator.check(token, secret);
    if (!isValid) return { error: "Código inválido" };

    await db.update(users)
        .set({ twoFactorEnabled: true, twoFactorSecret: secret })
        .where(eq(users.id, Number(userId)));

    revalidatePath("/security/2fa-setup");
    return { success: true };
}
