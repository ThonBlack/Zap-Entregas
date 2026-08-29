"use server";

import { db } from "@/db";
import {
    users,
    deliveries,
    transactions,
    reviews,
    pushSubscriptions,
    webauthnCredentials,
    passwordResets,
} from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { saveFile } from "@/lib/upload";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/password";
import { getAuthUserWithRole } from "@/lib/session";
import { generateInviteToken, getInviteExpiration } from "@/lib/invite";
import { isPlausiblePhone, normalizePhone, phoneVariants } from "@/lib/phone";
import { carregarMotoboyGerenciado } from "@/lib/team";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function pickFile(formData: FormData): File | null {
    const file = formData.get("avatar") as File | null;
    if (!file || typeof file === "string") return null;
    if (file.size === 0 || file.name === "undefined") return null;
    return file;
}

async function validateAvatarOrError(file: File): Promise<string | null> {
    if (file.size > MAX_AVATAR_BYTES) return "Imagem maior que 5MB.";
    if (!ALLOWED_MIME.has(file.type)) return "Formato de imagem inválido. Use JPG, PNG ou WebP.";
    return null;
}

/**
 * De qual loja o motoboy novo é.
 *
 * Lojista só cadastra pra própria loja — o campo do formulário é ignorado.
 * Admin escolhe; sem escolher, o motoboy nasce "da casa" (NULL) e só o admin
 * enxerga, pra não cair no colo de um lojista qualquer.
 */
async function donoDoMotoboyNovo(
    me: { id: number; role: string },
    escolhido: string | null
): Promise<number | null> {
    if (me.role !== "admin") return me.id;

    const id = Number(escolhido);
    if (!Number.isInteger(id) || id <= 0) return null;

    const lojista = await db.query.users.findFirst({
        where: and(eq(users.id, id), eq(users.role, "shopkeeper")),
        columns: { id: true },
    });
    return lojista?.id ?? null;
}

/** Erro do cadastro volta pela URL da lista (o form é um <form action> puro). */
function voltarPraListaComErro(mensagem: string): never {
    redirect(`/motoboys?erro=${encodeURIComponent(mensagem)}`);
}

export async function createMotoboyAction(formData: FormData): Promise<void> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) redirect("/login");
    const me = auth.user;

    const name = (formData.get("name") as string)?.trim();
    const phoneDigitado = (formData.get("phone") as string)?.trim();
    const password = (formData.get("password") as string) || "";

    if (!name || !phoneDigitado) {
        voltarPraListaComErro("Nome e telefone são obrigatórios.");
    }
    if (!isPlausiblePhone(phoneDigitado)) {
        voltarPraListaComErro("Telefone inválido. Use DDD + número (ex.: 34996802886).");
    }
    if (password && password.length < 8) {
        voltarPraListaComErro("A senha deve ter ao menos 8 caracteres.");
    }

    // Grava no formato do projeto (só dígitos, sem 55) e barra o mesmo número
    // escrito de outro jeito — senão viram duas contas que não se acham.
    const phone = normalizePhone(phoneDigitado);
    const jaExiste = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.phone, phoneVariants(phoneDigitado)))
        .get();
    if (jaExiste) voltarPraListaComErro("Telefone já cadastrado.");

    const file = pickFile(formData);
    let avatarUrl: string | null = null;

    if (file) {
        const err = await validateAvatarOrError(file);
        if (err) voltarPraListaComErro(err);
        avatarUrl = await saveFile(file);
    }

    // Sem senha digitada a conta nasce SEM senha (null). Nada de senha aleatória:
    // ela só existiria no banco, ninguém veria, e o motoboy ficaria trancado
    // do lado de fora. Quem cria a senha é ele, pelo link do convite.
    const hashedPassword = password ? await hashPassword(password) : null;

    const shopkeeperId = await donoDoMotoboyNovo(me, formData.get("shopkeeperId") as string | null);

    let novoId: number | undefined;

    try {
        const [criado] = await db.insert(users).values({
            name,
            phone,
            password: hashedPassword,
            avatarUrl,
            lastAvatarUpdate: avatarUrl ? new Date().toISOString() : null,
            role: "motoboy",
            shopkeeperId,
            inviteToken: generateInviteToken(),
            inviteTokenExpiresAt: getInviteExpiration(),
        }).returning({ id: users.id });
        novoId = criado?.id;
    } catch {
        voltarPraListaComErro("Erro ao criar motoboy. Telefone já cadastrado?");
    }

    if (!novoId) voltarPraListaComErro("Erro ao criar motoboy.");

    revalidatePath("/motoboys");
    redirect(`/motoboys/${novoId}/convite`);
}

/**
 * Gera um convite novo pro motoboy (o anterior, se houver, deixa de valer).
 * Usado quando o link venceu, se perdeu no WhatsApp ou o motoboy trocou de celular.
 */
export async function generateInviteAction(formData: FormData): Promise<void> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) redirect("/login");

    const id = Number(formData.get("id"));
    const alvo = await carregarMotoboyGerenciado(auth.user, id);
    if (!alvo) redirect("/motoboys");

    await db.update(users)
        .set({
            inviteToken: generateInviteToken(),
            inviteTokenExpiresAt: getInviteExpiration(),
        })
        .where(eq(users.id, alvo.id));

    revalidatePath("/motoboys");
    redirect(`/motoboys/${alvo.id}/convite`);
}

/**
 * "Redefinir acesso": o motoboy perdeu a senha e não há e-mail nem SMTP neste
 * app pra mandar link de recuperação. Então quem resolve é a loja — zera a senha
 * e gera um convite novo, o mesmo link de uso único do primeiro acesso.
 */
export async function resetMotoboyAccessAction(formData: FormData): Promise<void> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) redirect("/login");

    const id = Number(formData.get("id"));
    const alvo = await carregarMotoboyGerenciado(auth.user, id);
    if (!alvo) redirect("/motoboys");

    await db.update(users)
        .set({
            password: null,
            inviteToken: generateInviteToken(),
            inviteTokenExpiresAt: getInviteExpiration(),
        })
        .where(eq(users.id, alvo.id));

    revalidatePath("/motoboys");
    redirect(`/motoboys/${alvo.id}/convite`);
}

/** Erro volta pela URL: a ficha é um <form action> puro, sem estado no cliente. */
function voltarComErro(id: number, mensagem: string): never {
    redirect(`/motoboys/${id}?erro=${encodeURIComponent(mensagem)}`);
}

export async function updateMotoboyAction(formData: FormData): Promise<void> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) redirect("/login");

    const id = Number(formData.get("id"));
    const name = (formData.get("name") as string)?.trim();

    const target = await carregarMotoboyGerenciado(auth.user, id);
    if (!target) redirect("/motoboys");
    if (!name) voltarComErro(target.id, "O nome não pode ficar em branco.");

    let newAvatarUrl = target.avatarUrl;
    let newLastUpdate = target.lastAvatarUpdate;

    const file = pickFile(formData);
    if (file) {
        const err = await validateAvatarOrError(file);
        if (err) voltarComErro(target.id, err);

        if (target.lastAvatarUpdate) {
            const diffDays = Math.ceil(
                (Date.now() - new Date(target.lastAvatarUpdate).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays < 30) {
                voltarComErro(
                    target.id,
                    `A foto só pode ser alterada a cada 30 dias. Espere mais ${30 - diffDays} dias.`
                );
            }
        }

        newAvatarUrl = await saveFile(file);
        newLastUpdate = new Date().toISOString();
    }

    await db.update(users)
        .set({ name, avatarUrl: newAvatarUrl, lastAvatarUpdate: newLastUpdate })
        .where(eq(users.id, target.id));

    revalidatePath("/motoboys");
    redirect("/motoboys");
}

/** Tem corrida, lançamento ou avaliação amarrada a este motoboy? */
async function temHistorico(id: number): Promise<boolean> {
    const [corridas, lancamentos, avaliacoes] = await Promise.all([
        db.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.motoboyId, id)).limit(1),
        db.select({ id: transactions.id }).from(transactions)
            .where(or(eq(transactions.userId, id), eq(transactions.creatorId, id))).limit(1),
        db.select({ id: reviews.id }).from(reviews).where(eq(reviews.motoboyId, id)).limit(1),
    ]);
    return corridas.length > 0 || lancamentos.length > 0 || avaliacoes.length > 0;
}

/**
 * Tira o motoboy da equipe.
 *
 * Se ele já rodou (corrida, lançamento, avaliação), NÃO apaga: desativa. Apagar
 * levaria junto o extrato — e com ele a dívida que ele tem com a loja. Ele some
 * das listas, não entra mais no app, e o histórico continua de pé.
 *
 * Só quem nunca rodou é apagado de verdade (cadastro errado, telefone trocado).
 */
export async function deleteMotoboyAction(formData: FormData) {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return auth;

    const id = Number(formData.get("id"));
    const target = await carregarMotoboyGerenciado(auth.user, id);
    if (!target) return { error: "Motoboy não encontrado" };

    if (await temHistorico(target.id)) {
        await desativar(target.id);
        revalidatePath("/motoboys");
        return { success: true, desativado: true };
    }

    try {
        // Restos que só existem por causa dele e não são histórico de nada:
        // sem limpar, a chave estrangeira barra a exclusão.
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, target.id));
        await db.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, target.id));
        await db.delete(passwordResets).where(eq(passwordResets.userId, target.id));
        await db.delete(users).where(eq(users.id, target.id));
    } catch {
        // Sobrou algum vínculo que não previmos: desativa em vez de estourar erro.
        await desativar(target.id);
        revalidatePath("/motoboys");
        return { success: true, desativado: true };
    }

    revalidatePath("/motoboys");
    return { success: true, desativado: false };
}

async function desativar(id: number): Promise<void> {
    await db.update(users)
        .set({ isActive: false, inviteToken: null, inviteTokenExpiresAt: null })
        .where(eq(users.id, id));
    // Sessão aberta no celular dele deixa de valer no próximo carregamento
    // (loadSessionUser recusa isActive = false) e o aparelho para de receber push.
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, id));
}

/**
 * Volta atrás: motoboy desativado por engano (ou que voltou a trabalhar).
 * Sem retorno de propósito — vai direto num <form action> de página.
 */
export async function reactivateMotoboyAction(formData: FormData): Promise<void> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) redirect("/login");

    const id = Number(formData.get("id"));
    const target = await carregarMotoboyGerenciado(auth.user, id);
    if (!target) redirect("/motoboys");

    await db.update(users).set({ isActive: true }).where(eq(users.id, target.id));

    revalidatePath("/motoboys");
    redirect("/motoboys");
}
