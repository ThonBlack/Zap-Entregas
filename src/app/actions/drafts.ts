"use server";

import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthUserWithRole } from "@/lib/session";
import { conferirMotoboyDaCorrida } from "@/lib/trocaDeMotoboy";
import { liberarRascunho } from "@/lib/liberarRascunho";

type ActionResult = { error: string } | { success: true };

/**
 * Corridas criadas pelo PDV nascem com status "draft": ficam invisíveis pro motoboy
 * até o lojista (ou o admin) conferir o endereço no mapa e liberar.
 */

type LoadedDraft =
    | { ok: true; draft: typeof deliveries.$inferSelect }
    | { ok: false; error: string };

/**
 * Carrega o rascunho garantindo que quem pediu pode mexer nele.
 *
 * Dois caminhos de entrada:
 *  - logado no Zap (lojista dono ou admin);
 *  - com o código que o PDV recebeu ao criar a corrida — o caixa não tem conta aqui.
 *    Esse código autoriza UMA corrida, tem prazo e é apagado ao usar.
 */
async function loadDraft(id: number, confirmToken?: string | null): Promise<LoadedDraft> {
    if (confirmToken) {
        const draft = await db.query.deliveries.findFirst({
            where: eq(deliveries.confirmToken, confirmToken),
        });
        if (!draft) return { ok: false, error: "Link de conferência inválido." };
        if (id && draft.id !== id) return { ok: false, error: "Link não confere com a corrida." };
        if (draft.status !== "draft") return { ok: false, error: "Essa corrida já foi liberada." };
        if (draft.confirmTokenExpiresAt && new Date(draft.confirmTokenExpiresAt) < new Date()) {
            return { ok: false, error: "O link de conferência expirou. Confira pelo aplicativo." };
        }
        return { ok: true, draft };
    }

    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return { ok: false, error: auth.error };
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Corrida inválida." };

    const draft = await db.query.deliveries.findFirst({
        where: me.role === "admin"
            ? eq(deliveries.id, id)
            : and(eq(deliveries.id, id), eq(deliveries.shopkeeperId, me.id)),
    });

    if (!draft) return { ok: false, error: "Corrida não encontrada." };
    if (draft.status !== "draft") return { ok: false, error: "Essa corrida já foi liberada." };

    return { ok: true, draft };
}

export async function confirmDraftAction(formData: FormData): Promise<ActionResult> {
    const id = Number(formData.get("id"));
    const confirmToken = (formData.get("confirmToken") as string) || null;
    const loaded = await loadDraft(id, confirmToken);
    if (!loaded.ok) return { error: loaded.error };
    const { draft } = loaded;

    // Destinar a corrida a um motoboy da equipe é opcional: vazio = fila aberta.
    // Pela tela do PDV (sem login) não dá pra saber quem é a loja logada, então
    // o campo simplesmente não existe lá.
    //
    // A régua é a da troca de motoboy (src/lib/trocaDeMotoboy.ts): o motoboy
    // tem que servir a loja DA CORRIDA. Antes o admin, que gerencia todo mundo,
    // conseguia liberar o rascunho da loja A já no nome do motoboy da loja B.
    let destinatario: { id: number; name: string } | null = null;
    const motoboyIdBruto = String(formData.get("motoboyId") ?? "").trim();
    if (motoboyIdBruto && !confirmToken) {
        const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
        if ("error" in auth) return { error: auth.error };
        const me = auth.user;
        const conferido = await conferirMotoboyDaCorrida(
            me.role === "admin"
                ? { papel: "admin", id: me.id, nome: me.name }
                : { papel: "loja", id: me.id, nome: me.name },
            draft,
            Number(motoboyIdBruto),
        );
        if (!conferido.ok) return { error: conferido.erro };
        destinatario = conferido.motoboy;
    }

    // O resto (pino, cobrança, "Corrida N", UPDATE com trava, push) mora em
    // src/lib/liberarRascunho.ts — a Fila da loja libera pelo mesmo miolo.
    const resultado = await liberarRascunho(draft, formData, { destinatario });
    if ("error" in resultado) return resultado;

    // Aberto pelo PDV (com token): revalidar aqui re-renderiza a propria tela de
    // conferencia, que ja nao acha mais o token e mostraria "Link invalido".
    if (!confirmToken) revalidatePath("/app");
    return { success: true };
}

export async function cancelDraftAction(formData: FormData): Promise<ActionResult> {
    const id = Number(formData.get("id"));
    const confirmToken = (formData.get("confirmToken") as string) || null;
    const loaded = await loadDraft(id, confirmToken);
    if (!loaded.ok) return { error: loaded.error };

    const canceled = await db.update(deliveries)
        .set({
            status: "canceled",
            confirmToken: null,
            confirmTokenExpiresAt: null,
            updatedAt: new Date().toISOString(),
        })
        .where(and(eq(deliveries.id, loaded.draft.id), eq(deliveries.status, "draft")))
        .returning();

    if (!canceled.length) return { error: "Essa corrida já foi liberada." };

    // Mesmo motivo do confirmDraftAction: com token, a tela do PDV se auto-invalida.
    if (!confirmToken) revalidatePath("/app");
    return { success: true };
}
