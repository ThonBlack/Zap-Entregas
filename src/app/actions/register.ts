"use server";

import { db } from "../../db";
import { users } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { hashPassword } from "../../lib/password";
import { setSessionCookie } from "../../lib/session";
import { defaultsDeContaNova } from "../../lib/signup";
import { isPlausiblePhone, normalizePhone, phoneVariants } from "../../lib/phone";
import { conviteDeLojistaValido } from "../../lib/registerInvite";
import { aplicarLimite, ipDeQuemChamou, mensagemDeEspera } from "../../lib/rateLimit";

/**
 * Mesma resposta para "celular já existe" e "e-mail já existe".
 *
 * /register é público. Se a tela dissesse qual campo colidiu, dava pra varrer
 * DDDs e montar a lista de celulares cadastrados no app — e o produto vive no
 * WhatsApp, então essa lista é ouro pra golpista. A frase ainda diz o caminho
 * de saída (entrar em vez de cadastrar) sem confirmar nada.
 */
const CONTA_JA_EXISTE =
    "Não foi possível criar a conta com esses dados. Se você já tem conta, use a tela de Login — inclusive o botão 'Entrar com Google'.";

/** O SQLite reclamou de valor repetido (índice único)? */
function ehErroDeDuplicidade(e: unknown): boolean {
    const code = (e as { code?: unknown } | null)?.code;
    if (typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT")) return true;
    const msg = e instanceof Error ? e.message : String(e ?? "");
    return msg.toUpperCase().includes("UNIQUE");
}

export async function registerAction(prevState: any, formData: FormData) {
    const name = formData.get("name") as string;
    const phoneDigitado = formData.get("phone") as string;
    const emailDigitado = formData.get("email") as string | null;
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
    if (role === "shopkeeper") {
        // O código é comparado com "===" simples: sem limite dava pra adivinhá-lo
        // por força bruta e se auto-cadastrar como LOJISTA. Cinco chutes por hora
        // por IP — quem tem o código de verdade acerta de primeira.
        const ip = ipDeQuemChamou(await headers());
        const limite = aplicarLimite("conviteLojista", `ip:${ip}`);
        if (!limite.permitido) {
            return { message: mensagemDeEspera(limite.esperarSegundos) };
        }
        if (!conviteDeLojistaValido(conviteLojista)) {
            return { message: "Cadastro de lojista é só por convite. Fale com a loja." };
        }
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
        return { message: CONTA_JA_EXISTE };
    }

    // E-mail sempre em minúsculas e sem espaços: é assim que o login pelo Google
    // grava, e o banco tem índice único nessa coluna.
    const email = (emailDigitado || "").trim().toLowerCase() || null;

    // Quem já entrou pelo Google tem conta com esse e-mail e sem senha. Sem esta
    // conferência o insert estoura no índice único e a tela dá erro 500.
    if (email) {
        const emailEmUso = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .get();
        if (emailEmUso) {
            return { message: CONTA_JA_EXISTE };
        }
    }

    // Mesmo estado inicial do cadastro pelo Google (plano/teste)
    const padroes = await defaultsDeContaNova();

    // Hash da senha antes de salvar
    const hashedPassword = await hashPassword(password);

    // Create user with trial if applicable
    // Entre a conferência acima e o insert alguém pode ter criado a mesma conta,
    // e o banco tem índices únicos — sem o try/catch isso vira erro 500 na cara
    // da pessoa em vez de uma mensagem.
    let newUser;
    try {
        newUser = await db.insert(users).values({
            name,
            phone,
            email, // Email opcional para recuperação de senha
            password: hashedPassword,
            role,
            ...padroes,
            createdAt: new Date().toISOString(),
        }).returning().get();
    } catch (e) {
        if (ehErroDeDuplicidade(e)) {
            return { message: CONTA_JA_EXISTE };
        }
        console.error("[REGISTER] falha ao criar conta:", e);
        return { message: "Erro ao criar conta. Tente novamente." };
    }

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
