"use server";

import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPassword, hashPassword, isPasswordHashed } from "../../lib/password";

export async function loginAction(prevState: any, formData: FormData) {
    const phone = formData.get("phone") as string;
    const password = formData.get("password") as string;

    if (!phone || !password) {
        return { error: "Preencha todos os campos" };
    }

    // Busca usuário
    const user = await db.select().from(users).where(eq(users.phone, phone)).get();

    if (!user || !user.password) {
        return { error: "Credenciais inválidas" };
    }

    // Verifica se usuário está ativo
    if (user.isActive === false) {
        return { error: "Conta desativada. Entre em contato com o suporte." };
    }

    // Verifica senha (suporta bcrypt e texto plano para migração gradual)
    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
        return { error: "Credenciais inválidas" };
    }

    // Migração automática: se senha é texto plano, atualiza para hash
    if (!isPasswordHashed(user.password)) {
        const hashedPassword = await hashPassword(password);
        await db.update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, user.id));
        console.log(`[Auth] Senha do usuário ID ${user.id} migrada para bcrypt`);
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
