"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { hashPassword, verifyPassword } from "@/lib/password";
import { invalidarLinksDeSenha } from "@/lib/passwordResets";
import { getAuthUser } from "@/lib/session";

export type TrocarSenhaState = {
    message?: string;
    success?: boolean;
} | null;

/**
 * Trocar a própria senha, de dentro do app.
 *
 * Até agora só existia o "esqueci minha senha" por e-mail — e ninguém neste app
 * tem e-mail cadastrado, nem há servidor de e-mail configurado. Ou seja: quem
 * quisesse trocar a senha não tinha por onde.
 *
 * Quem entrou pelo Google ou pelo link de convite pode não ter senha nenhuma
 * ainda; nesse caso não há "senha atual" pra pedir.
 */
export async function changePasswordAction(
    _prev: TrocarSenhaState,
    formData: FormData
): Promise<TrocarSenhaState> {
    const auth = await getAuthUser();
    if ("error" in auth) return { message: "Faça login de novo pra trocar a senha." };

    const atual = String(formData.get("currentPassword") ?? "");
    const nova = String(formData.get("newPassword") ?? "");
    const confirmacao = String(formData.get("confirmPassword") ?? "");

    if (nova.length < 8) {
        return { message: "A senha nova precisa ter pelo menos 8 caracteres." };
    }
    if (nova !== confirmacao) {
        return { message: "A confirmação não bate com a senha nova." };
    }

    const user = await db.query.users.findFirst({
        where: eq(users.id, auth.user.id),
        columns: { id: true, password: true },
    });
    if (!user) return { message: "Faça login de novo pra trocar a senha." };

    // Só quem já tem senha precisa provar que sabe a antiga.
    if (user.password) {
        if (!atual) return { message: "Digite sua senha atual." };
        const confere = await verifyPassword(atual, user.password);
        if (!confere) return { message: "Senha atual incorreta." };
        if (atual === nova) return { message: "A senha nova tem que ser diferente da atual." };
    }

    await db.update(users)
        .set({ password: await hashPassword(nova) })
        .where(eq(users.id, user.id));

    // Trocou a senha aqui? Link de recuperação pendente perde a validade.
    await invalidarLinksDeSenha(user.id);

    revalidatePath("/settings");
    revalidatePath("/settings/motoboy");

    return { success: true, message: "Senha trocada. Use a nova no próximo login." };
}
