"use server";

import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authenticator } from "otplib";

import { verifyPassword } from "../../lib/password";
import {
    setSessionCookie,
    setTwoFactorPendingCookie,
    getTwoFactorPendingUserId,
    clearTwoFactorPendingCookie,
    getSessionUserId,
} from "../../lib/session";

export async function loginAction(prevState: any, formData: FormData) {
    const phone = formData.get("phone") as string;
    const password = formData.get("password") as string;

    if (!phone || !password) {
        return { error: "Preencha todos os campos" };
    }

    const user = await db.select().from(users).where(eq(users.phone, phone)).get();

    if (!user || !user.password) {
        return { error: "Credenciais inválidas" };
    }

    if (user.isActive === false) {
        return { error: "Conta desativada. Entre em contato com o suporte." };
    }

    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
        return { error: "Credenciais inválidas" };
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
        await setTwoFactorPendingCookie(user.id);
        redirect("/login/2fa");
    }

    await setSessionCookie(user.id);
    redirect("/app");
}

export async function verifyTwoFactorAction(token: string) {
    const pendingId = await getTwoFactorPendingUserId();
    if (!pendingId) return { error: "Sessão expirada. Faça login novamente." };

    const user = await db.select().from(users).where(eq(users.id, pendingId)).get();

    if (!user || !user.twoFactorSecret) return { error: "Erro de autenticação." };

    try {
        const isValid = authenticator.check(token, user.twoFactorSecret);
        if (!isValid) return { error: "Código inválido." };
    } catch {
        return { error: "Erro ao validar código." };
    }

    await clearTwoFactorPendingCookie();
    await setSessionCookie(user.id);
    redirect("/app");
}

export async function generateTwoFactorSecretAction() {
    const userId = await getSessionUserId();
    if (!userId) return { error: "Não autenticado" };

    const secret = authenticator.generateSecret();
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const otpauth = authenticator.keyuri(user?.phone || "user", "ZapEntregas", secret);

    return { secret, otpauth };
}

export async function enableTwoFactorAction(token: string, secret: string) {
    const userId = await getSessionUserId();
    if (!userId) return { error: "Não autenticado" };

    const isValid = authenticator.check(token, secret);
    if (!isValid) return { error: "Código inválido" };

    await db.update(users)
        .set({ twoFactorEnabled: true, twoFactorSecret: secret })
        .where(eq(users.id, userId));

    revalidatePath("/security/2fa-setup");
    return { success: true };
}
