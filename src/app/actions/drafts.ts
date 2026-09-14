"use server";

import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { geocodeAddress, type GeocodeOpts } from "@/lib/routeUtils";
import { getAuthUserWithRole } from "@/lib/session";
import { pushDeCorridaNova, pushDeCorridaDestinada } from "@/lib/push";
import { parseMoney } from "@/lib/money";
import { logServerError } from "@/lib/serverLog";
import { avisoDeCorridaNova, resumoDoLocal } from "@/lib/deliveryPrivacy";
import { carregarMotoboyGerenciado } from "@/lib/team";
import { normalizarChargeMode, type ChargeMode } from "@/lib/chargeMode";

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

    const address = (formData.get("address") as string)?.trim();
    if (!address) return { error: "Endereço obrigatório." };

    /**
     * Dinheiro digitado na tela. Vazio é zero; texto ilegível é `null` e vira
     * erro — o conversor antigo lia "1.850,00" como R$ 1,85 sem reclamar.
     */
    const lerDinheiro = (raw: FormDataEntryValue | null): number | null => {
        const texto = String(raw ?? "").trim();
        if (!texto) return 0;
        const n = parseMoney(texto);
        return n === null || n < 0 ? null : n;
    };

    // Tipo de cobrança: "Receber na entrega", "Conferir Pix da loja" ou "Já pago".
    // "Já pago" zera o valor — é assim que o motoboy sabe que não tem o que cobrar.
    // Formulário antigo (sem o campo) cai na régua velha do checkbox "collect".
    const chargeMode: ChargeMode = formData.has("chargeMode")
        ? normalizarChargeMode(formData.get("chargeMode"), null)
        : (formData.get("collect") === "on" ? "receber" : "pago");
    // Em "Já pago" o campo de valor está escondido na tela: nem lê, pra um
    // rascunho de texto esquecido lá dentro não derrubar a liberação.
    const valorLido = chargeMode === "pago" ? 0 : lerDinheiro(formData.get("value"));
    if (valorLido === null) return { error: "Valor a receber inválido. Escreva assim: 12,50" };
    const value = valorLido;
    const fee = lerDinheiro(formData.get("fee"));
    if (fee === null) return { error: "Taxa da corrida inválida. Escreva assim: 12,50" };

    // Destinar a corrida a um motoboy da equipe é opcional: vazio = fila aberta.
    // Pela tela do PDV (sem login) não dá pra saber quem é a loja logada, então
    // o campo simplesmente não existe lá.
    let destinatario: { id: number; name: string } | null = null;
    const motoboyIdBruto = String(formData.get("motoboyId") ?? "").trim();
    if (motoboyIdBruto && !confirmToken) {
        const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
        if ("error" in auth) return { error: auth.error };
        const escolhido = await carregarMotoboyGerenciado(auth.user, Number(motoboyIdBruto));
        if (!escolhido) return { error: "Esse motoboy não é da sua equipe." };
        destinatario = { id: escolhido.id, name: escolhido.name };
    }

    // O pino do mapa manda coordenadas; se vierem vazias, tenta geocodificar o endereço editado.
    // `pinTouched` diz se ALGUÉM de fato mexeu no pino. Sem isso o formulário
    // mandava as coordenadas da loja (o ponto de partida quando o geocode falha)
    // e a corrida era gravada como "exata" — o motoboy chegava na casa do cliente
    // e o botão "Entregue" ficava bloqueado, porque a cerca media a distância até a LOJA.
    const pinTouched = formData.get("pinTouched") === "1";
    let lat = Number(formData.get("lat"));
    let lng = Number(formData.get("lng"));
    const pinValid = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    const semPinoDeOrigem = !draft.lat || draft.lat === 0;

    // Endereço que nunca foi localizado no mapa só pode ser liberado com o pino
    // colocado na mão — senão a corrida sai com as coordenadas da loja.
    if (semPinoDeOrigem && !pinTouched) {
        return {
            error: "Esse endereço não foi encontrado no mapa. Arraste o pino até o lugar da entrega antes de liberar.",
        };
    }

    const enderecoMudou = address !== draft.address;
    // Só é "exata" quando uma pessoa colocou o pino no lugar. Sem isso vale a
    // precisão que o geocode achou (ou nada) — e a tela do lojista continua
    // avisando que o ponto é chute.
    let geoPrecision: string | null = draft.geoPrecision ?? null;

    if (pinTouched && pinValid) {
        geoPrecision = "exata";
    } else {
        // Ninguém mexeu no pino: o ponto que vale é o do geocode. Se o endereço
        // foi editado, o ponto antigo não serve mais — procura de novo.
        lat = draft.lat ?? 0;
        lng = draft.lng ?? 0;
        if (enderecoMudou || lat === 0 || lng === 0) {
            lat = 0; lng = 0;
            geoPrecision = null;
            try {
                const s = await db.query.shopSettings.findFirst({
                    where: eq(shopSettings.userId, draft.shopkeeperId ?? -1),
                    columns: { defaultCity: true, defaultState: true, shopLat: true, shopLng: true },
                });
                const opts: GeocodeOpts = {
                    defaultCity: s?.defaultCity ?? null,
                    defaultState: s?.defaultState ?? null,
                    shopLat: s?.shopLat ?? null,
                    shopLng: s?.shopLng ?? null,
                };
                const coords = await geocodeAddress(address, opts);
                if (coords) { lat = coords.lat; lng = coords.lng; geoPrecision = coords.precision; }
            } catch (e) {
                console.error("[DRAFT] geocode na confirmação falhou:", e);
                await logServerError("draft_geocode_falhou", e, { deliveryId: draft.id, page: "/confirmar" });
            }
        }
    }

    const customerName = (formData.get("customerName") as string)?.trim() || null;
    const customerPhone = (formData.get("customerPhone") as string)?.trim() || null;
    const observationDigitada = (formData.get("observation") as string)?.trim() || null;
    const observation = destinatario
        ? [observationDigitada, `destinada pela loja a ${destinatario.name}`]
            .filter(Boolean).join(" · ").slice(0, 1000)
        : observationDigitada;

    const agora = new Date().toISOString();

    // Condição de corrida: só libera se ainda estiver como rascunho (dois cliques não
    // podem notificar os motoboys duas vezes).
    const updated = await db.update(deliveries)
        .set({
            // Código usado: não serve de novo.
            confirmToken: null,
            confirmTokenExpiresAt: null,
            address, lat, lng, value, fee, customerName, customerPhone, observation,
            chargeMode,
            geoPrecision,
            // Destinada a alguém já nasce "aceita": ele não precisa disputar no
            // pool uma corrida que a loja deu pra ele.
            motoboyId: destinatario?.id ?? null,
            status: destinatario ? "assigned" : "pending",
            acceptedAt: destinatario ? agora : null,
            updatedAt: agora,
        })
        .where(and(eq(deliveries.id, draft.id), eq(deliveries.status, "draft")))
        .returning();

    if (!updated.length) return { error: "Essa corrida já foi liberada." };

    // Endereço com número é dado pessoal do cliente saindo do app pra um
    // aparelho que a loja não controla — nos dois casos vai só o bairro.
    if (destinatario) {
        // Corrida com dono não vira anúncio: só o escolhido é avisado.
        pushDeCorridaDestinada(destinatario.id, draft.id, resumoDoLocal(address), null)
            .catch(() => { });
    } else {
        // Só quem pode VER essa corrida é avisado (regra única em team.ts).
        pushDeCorridaNova(draft.shopkeeperId, {
            title: "🏍️ Nova Corrida Disponível!",
            body: avisoDeCorridaNova(address),
            url: "/app",
            tag: "nova-corrida",
        }).catch(() => { });
    }

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
