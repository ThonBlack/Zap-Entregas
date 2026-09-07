"use server";

import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { geocodeAddress, type GeocodeOpts } from "@/lib/routeUtils";
import { getAuthUserWithRole } from "@/lib/session";
import { parseMoney } from "@/lib/money";

type ActionResult = { error: string } | { success: true };

/**
 * Dinheiro digitado na tela. Campo vazio é zero; texto que não dá pra ler é
 * `null` e vira erro na tela — nunca zero calado (o conversor antigo lia
 * "1.850,00" como R$ 1,85).
 */
const lerDinheiro = (raw: FormDataEntryValue | null): number | null => {
    const texto = String(raw ?? "").trim();
    if (!texto) return 0;
    const n = parseMoney(texto);
    return n === null || n < 0 ? null : n;
};

/**
 * Corrigir uma corrida que o lojista acabou de criar.
 *
 * Janela de edição: enquanto ela ainda está "pending" e NENHUM motoboy aceitou.
 * Depois disso o endereço já está no bolso de alguém — mudar por baixo criaria
 * uma entrega diferente da que a pessoa aceitou. Por isso o UPDATE repete a
 * condição no WHERE: se alguém aceitar no meio do caminho, nada é gravado.
 */
export async function updatePendingDeliveryAction(formData: FormData): Promise<ActionResult> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return { error: auth.error };
    const me = auth.user;

    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) return { error: "Corrida inválida." };

    const atual = await db.query.deliveries.findFirst({
        where: me.role === "admin"
            ? eq(deliveries.id, id)
            : and(eq(deliveries.id, id), eq(deliveries.shopkeeperId, me.id)),
    });

    if (!atual) return { error: "Corrida não encontrada." };
    if (atual.status !== "pending" || atual.motoboyId != null) {
        return { error: "Essa corrida já foi aceita por um motoboy — não dá mais pra editar." };
    }

    const address = (formData.get("address") as string)?.trim();
    if (!address) return { error: "Endereço obrigatório." };

    const shouldCollect = formData.get("collect") === "on";
    const value = shouldCollect ? lerDinheiro(formData.get("value")) : 0;
    const fee = lerDinheiro(formData.get("fee"));
    if (value === null) return { error: "Valor a receber inválido. Escreva assim: 12,50" };
    if (fee === null) return { error: "Taxa da corrida inválida. Escreva assim: 12,50" };

    const customerName = (formData.get("customerName") as string)?.trim() || null;
    const customerPhone = (formData.get("customerPhone") as string)?.trim() || null;
    const observation = (formData.get("observation") as string)?.trim() || null;

    // O pino do mapa manda coordenadas. Se a pessoa não encostou no pino e mudou o
    // endereço, o ponto antigo não vale mais: geocodifica de novo.
    const pinTouched = formData.get("pinTouched") === "1";
    let lat = Number(formData.get("lat"));
    let lng = Number(formData.get("lng"));
    const pinValid = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    const enderecoMudou = address !== atual.address;

    let geoPrecision: string | null = atual.geoPrecision ?? null;

    if (pinTouched && pinValid) {
        geoPrecision = "exata";
    } else if (enderecoMudou || !pinValid) {
        lat = 0; lng = 0;
        geoPrecision = null;
        try {
            const s = await db.query.shopSettings.findFirst({
                where: eq(shopSettings.userId, atual.shopkeeperId ?? -1),
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
            console.error("[EDITAR] geocode falhou:", e);
        }
        // Geocode falhou mas o pino que veio da tela é válido: melhor ele do que 0,0.
        if (lat === 0 && lng === 0 && pinValid) {
            lat = Number(formData.get("lat"));
            lng = Number(formData.get("lng"));
            geoPrecision = atual.geoPrecision ?? null;
        }
    }

    const updated = await db.update(deliveries)
        .set({
            address, lat, lng, value, fee, customerName, customerPhone, observation,
            geoPrecision,
            updatedAt: new Date().toISOString(),
        })
        .where(and(
            eq(deliveries.id, atual.id),
            eq(deliveries.status, "pending"),
            isNull(deliveries.motoboyId),
        ))
        .returning();

    if (!updated.length) {
        return { error: "Essa corrida já foi aceita por um motoboy — não dá mais pra editar." };
    }

    revalidatePath("/app");
    return { success: true };
}
