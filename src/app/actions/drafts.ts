"use server";

import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { geocodeAddress, type GeocodeOpts } from "@/lib/routeUtils";
import { getAuthUserWithRole } from "@/lib/session";
import { pushToMotoboys } from "@/lib/push";

type ActionResult = { error: string } | { success: true };

/**
 * Corridas criadas pelo PDV nascem com status "draft": ficam invisíveis pro motoboy
 * até o lojista (ou o admin) conferir o endereço no mapa e liberar.
 */

type LoadedDraft =
    | { ok: true; draft: typeof deliveries.$inferSelect }
    | { ok: false; error: string };

/** Carrega o rascunho garantindo que quem pediu pode mexer nele. */
async function loadDraft(id: number): Promise<LoadedDraft> {
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
    const loaded = await loadDraft(id);
    if (!loaded.ok) return { error: loaded.error };
    const { draft } = loaded;

    const address = (formData.get("address") as string)?.trim();
    if (!address) return { error: "Endereço obrigatório." };

    const parseMoney = (raw: FormDataEntryValue | null) => {
        const n = Number(String(raw ?? "").replace(",", "."));
        return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    // "É pra receber" desligado zera o valor: é assim que o motoboy sabe que já está pago
    // (o modal de finalizar usa value > 0 como régua).
    const shouldCollect = formData.get("collect") === "on";
    const value = shouldCollect ? parseMoney(formData.get("value")) : 0;
    const fee = parseMoney(formData.get("fee"));

    // O pino do mapa manda coordenadas; se vierem vazias, tenta geocodificar o endereço editado.
    let lat = Number(formData.get("lat"));
    let lng = Number(formData.get("lng"));
    const pinValid = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

    if (!pinValid) {
        lat = 0; lng = 0;
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
            if (coords) { lat = coords.lat; lng = coords.lng; }
        } catch (e) {
            console.error("[DRAFT] geocode na confirmação falhou:", e);
        }
    }

    const customerName = (formData.get("customerName") as string)?.trim() || null;
    const customerPhone = (formData.get("customerPhone") as string)?.trim() || null;
    const observation = (formData.get("observation") as string)?.trim() || null;

    // Condição de corrida: só libera se ainda estiver como rascunho (dois cliques não
    // podem notificar os motoboys duas vezes).
    const updated = await db.update(deliveries)
        .set({
            address, lat, lng, value, fee, customerName, customerPhone, observation,
            status: "pending",
            updatedAt: new Date().toISOString(),
        })
        .where(and(eq(deliveries.id, id), eq(deliveries.status, "draft")))
        .returning();

    if (!updated.length) return { error: "Essa corrida já foi liberada." };

    pushToMotoboys({
        title: "🏍️ Nova Corrida Disponível!",
        body: address,
        url: "/app",
        tag: "nova-corrida",
    }).catch(() => { });

    revalidatePath("/app");
    return { success: true };
}

export async function cancelDraftAction(formData: FormData): Promise<ActionResult> {
    const id = Number(formData.get("id"));
    const loaded = await loadDraft(id);
    if (!loaded.ok) return { error: loaded.error };

    const canceled = await db.update(deliveries)
        .set({ status: "canceled", updatedAt: new Date().toISOString() })
        .where(and(eq(deliveries.id, id), eq(deliveries.status, "draft")))
        .returning();

    if (!canceled.length) return { error: "Essa corrida já foi liberada." };

    revalidatePath("/app");
    return { success: true };
}
