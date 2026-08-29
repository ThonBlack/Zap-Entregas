"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

import { hashPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";
import { isInviteExpired } from "@/lib/invite";

/**
 * Aceitar o convite: o motoboy cria a senha dele e já entra.
 *
 * Rota PÚBLICA (quem abre não tem login). O que autoriza é o código da URL, que
 * vale pra uma conta só, vence em 7 dias e é apagado assim que usado.
 */
export async function acceptInviteAction(token: string, password: string) {
    if (!token || token.length < 16) {
        return { error: "Convite inválido." };
    }
    if (!password || password.length < 8) {
        return { error: "A senha precisa ter pelo menos 8 caracteres." };
    }

    const user = await db.query.users.findFirst({
        where: eq(users.inviteToken, token),
        columns: {
            id: true,
            name: true,
            role: true,
            isActive: true,
            inviteTokenExpiresAt: true,
        },
    });

    if (!user || user.role !== "motoboy") {
        return { error: "Convite inválido ou já utilizado." };
    }
    if (isInviteExpired(user.inviteTokenExpiresAt)) {
        return { error: "Convite expirado. Peça um novo convite pra loja." };
    }
    if (user.isActive === false) {
        return { error: "Conta desativada. Fale com a loja." };
    }

    const hashed = await hashPassword(password);

    await db.update(users)
        .set({
            password: hashed,
            inviteToken: null,
            inviteTokenExpiresAt: null,
        })
        .where(eq(users.id, user.id));

    // Acabou de provar que é dono do convite e definiu a senha: já entra logado.
    await setSessionCookie(user.id);

    return { success: true };
}
