"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/password";
import { invalidarLinksDeSenha } from "@/lib/passwordResets";
import { getAuthUser } from "@/lib/session";
import { isPlausiblePhone, normalizePhone, phoneVariants } from "@/lib/phone";

export interface CompletarCadastroState {
    message?: string;
}

/**
 * Fecha o cadastro de quem entrou pelo Google: telefone (obrigatório, porque é
 * por ele que a loja fala com o motoboy) e senha (opcional — quem quiser poder
 * entrar sem o Google).
 */
export async function completarCadastroAction(
    _prevState: CompletarCadastroState,
    formData: FormData
): Promise<CompletarCadastroState> {
    const auth = await getAuthUser();
    if ("error" in auth) redirect("/login");

    const digitado = (formData.get("phone") as string) || "";
    const senha = ((formData.get("password") as string) || "").trim();

    if (!isPlausiblePhone(digitado)) {
        return { message: "Digite o celular com DDD, só números. Ex.: 34996802886" };
    }
    // Grava no formato do projeto: só dígitos, sem o 55.
    const telefone = normalizePhone(digitado);

    if (senha && senha.length < 8) {
        return { message: "A senha deve ter pelo menos 8 caracteres." };
    }

    const jaUsado = await db.select({ id: users.id }).from(users)
        .where(inArray(users.phone, phoneVariants(digitado))).get();
    if (jaUsado && jaUsado.id !== auth.user.id) {
        return { message: "Esse celular já está cadastrado em outra conta." };
    }

    const mudancas: { phone: string; password?: string } = { phone: telefone };
    if (senha) mudancas.password = await hashPassword(senha);

    try {
        await db.update(users).set(mudancas).where(eq(users.id, auth.user.id));
    } catch {
        return { message: "Não consegui salvar. Confira o celular e tente de novo." };
    }

    // Definiu senha aqui: link de recuperação pendente perde a validade.
    if (senha) await invalidarLinksDeSenha(auth.user.id);

    revalidatePath("/app");
    redirect("/app");
}
