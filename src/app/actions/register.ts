"use server";

import { db } from "../../db";
import { users } from "../../db/schema";
import { inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { hashPassword } from "../../lib/password";
import { setSessionCookie } from "../../lib/session";
import { defaultsDeContaNova } from "../../lib/signup";
import { isPlausiblePhone, normalizePhone, phoneVariants } from "../../lib/phone";
import { conviteDeLojistaValido } from "../../lib/registerInvite";

export async function registerAction(prevState: any, formData: FormData) {
    const name = formData.get("name") as string;
    const phoneDigitado = formData.get("phone") as string;
    const email = formData.get("email") as string | null;
    const password = formData.get("password") as string;
    const role = formData.get("role") as "shopkeeper" | "motoboy";
    const conviteLojista = (formData.get("convite_lojista") as string) || "";

    if (!name || !phoneDigitado || !password || !role) {
        return { message: "Preencha todos os campos obrigatórios." };
    }

    if (password.length < 8) {
        return { message: "A senha deve ter pelo menos 8 caracteres." };
    }

    if (role !== "shopkeeper" && role !== "motoboy") {
        return { message: "Tipo de conta inválido." };
    }

    // Conta de lojista não sai por cadastro aberto: quem manda no app é ela
    // (vê endereço, telefone e dinheiro). Só com o código de convite da loja.
    if (role === "shopkeeper" && !conviteDeLojistaValido(conviteLojista)) {
        return { message: "Cadastro de lojista é só por convite. Fale com a loja." };
    }

    if (!isPlausiblePhone(phoneDigitado)) {
        return { message: "Digite o celular com DDD, só números. Ex.: 34996802886" };
    }
    const phone = normalizePhone(phoneDigitado);

    // Confere contra todas as formas do mesmo número (com/sem 55, com/sem 9º
    // dígito), senão a mesma pessoa cria duas contas e nenhuma acha a outra.
    const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.phone, phoneVariants(phoneDigitado)))
        .get();
    if (existingUser) {
        return { message: "Este número de celular já está cadastrado." };
    }

    // Mesmo estado inicial do cadastro pelo Google (plano/teste)
    const padroes = await defaultsDeContaNova();

    // Hash da senha antes de salvar
    const hashedPassword = await hashPassword(password);

    // Create user with trial if applicable
    const newUser = await db.insert(users).values({
        name,
        phone,
        email: email || null, // Email opcional para recuperação de senha
        password: hashedPassword,
        role,
        ...padroes,
    }).returning().get();

    if (!newUser) {
        return { message: "Erro ao criar conta. Tente novamente." };
    }

    // Auto-login after registration
    await setSessionCookie(newUser.id);

    if (role === 'shopkeeper') {
        redirect("/settings");
    } else {
        redirect("/app");
    }
}
