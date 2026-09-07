"use server";

import { db } from "../../db";
import { users } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { authenticator } from "otplib";

import { verifyPassword } from "../../lib/password";
import {
    aplicarLimite,
    limparLimite,
    ipDeQuemChamou,
    mensagemDeEspera,
} from "../../lib/rateLimit";
import {
    setSessionCookie,
    setTwoFactorPendingCookie,
    getTwoFactorPendingUserId,
    clearTwoFactorPendingCookie,
    getSessionUserId,
} from "../../lib/session";
import { normalizePhone, phoneVariants, pickPhoneMatch } from "../../lib/phone";

export async function loginAction(prevState: any, formData: FormData) {
    const phone = formData.get("phone") as string;
    const password = formData.get("password") as string;

    if (!phone || !password) {
        return { error: "Preencha todos os campos" };
    }

    // Limite de tentativas: sem isso um robô varre senhas à vontade. Contamos por
    // IP (quem está tentando) E por celular (o alvo) — o primeiro segura o robô
    // de um lugar só, o segundo segura o ataque distribuído contra uma conta.
    const ip = ipDeQuemChamou(await headers());
    const alvo = normalizePhone(phone);
    const porIp = aplicarLimite("login", `ip:${ip}`);
    if (!porIp.permitido) {
        return { error: mensagemDeEspera(porIp.esperarSegundos) };
    }
    const porTelefone = aplicarLimite("login", `tel:${alvo}`);
    if (!porTelefone.permitido) {
        return { error: mensagemDeEspera(porTelefone.esperarSegundos) };
    }

    // O mesmo celular pode estar gravado com máscara, com 55 na frente ou sem o
    // 9º dígito. Procuramos por todas as formas equivalentes: quem foi cadastrado
    // como "3496944103" entra digitando "(34) 99694-4103".
    const candidatos = await db
        .select()
        .from(users)
        .where(inArray(users.phone, phoneVariants(phone)));
    const user = pickPhoneMatch(candidatos, phone);

    if (!user || !user.password) {
        return { error: "Credenciais inválidas" };
    }

    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
        return { error: "Credenciais inválidas" };
    }

    // "Conta desativada" SÓ depois de conferir a senha. Antes vinha primeiro, e
    // isso respondia "esse número existe aqui" pra quem só chutou o telefone —
    // lista pronta de celulares de lojista e motoboy pra golpe no WhatsApp.
    if (user.isActive === false) {
        return { error: "Conta desativada. Entre em contato com o suporte." };
    }

    // Senha certa: o contador zera, senão quem erra 9 vezes e acerta na décima
    // ficaria de castigo por 15 minutos.
    limparLimite("login", `ip:${ip}`);
    limparLimite("login", `tel:${alvo}`);

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

    // O código tem 6 dígitos: sem limite, um robô varre o milhão de combinações
    // enquanto o meio-login valer. Cinco erros e o meio-login é JOGADO FORA —
    // quem errou tanto assim volta pro começo e digita senha de novo.
    const limite = aplicarLimite("doisFatores", `user:${user.id}`);
    if (!limite.permitido) {
        await clearTwoFactorPendingCookie();
        limparLimite("doisFatores", `user:${user.id}`);
        return { error: "Muitas tentativas. Faça login novamente." };
    }

    try {
        const isValid = authenticator.check(token, user.twoFactorSecret);
        if (!isValid) return { error: "Código inválido." };
    } catch {
        return { error: "Erro ao validar código." };
    }

    limparLimite("doisFatores", `user:${user.id}`);
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
