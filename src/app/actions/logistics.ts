"use server";

import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { eq, inArray, and, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { geocodeAddress, optimizeRoute, type GeocodeOpts } from "@/lib/routeUtils";
import { getAuthUser, getAuthUserWithRole } from "@/lib/session";
import { newTrackingToken } from "@/lib/trackingToken";
import { pushToMotoboys, pushToUser } from "@/lib/push";
import { validarRecebimento, type DeliveryReceipt, type RecebimentoValidado } from "@/lib/receipt";
import { fecharCorridaNoBanco } from "@/lib/deliveryLedger";
import { parseMoney } from "@/lib/money";
import { calcularTaxa, distanciaDaLoja } from "@/lib/fee";
import { existeCorridaIgualRecente } from "@/lib/deliveryGuards";

async function loadGeocodeOpts(shopkeeperId: number): Promise<GeocodeOpts> {
    const s = await db.query.shopSettings.findFirst({
        where: eq(shopSettings.userId, shopkeeperId),
        columns: { defaultCity: true, defaultState: true, shopLat: true, shopLng: true },
    });
    return {
        defaultCity: s?.defaultCity ?? null,
        defaultState: s?.defaultState ?? null,
        shopLat: s?.shopLat ?? null,
        shopLng: s?.shopLng ?? null,
    };
}

export async function addDeliveryAction(formData: FormData) {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    const address = (formData.get("address") as string)?.trim();
    const customerName = formData.get("customerName") as string;
    const observation = formData.get("observation") as string;

    if (!address) return { error: "Endereço obrigatório" };

    // "1.850,00" digitado à mão virava R$ 1,85 no conversor antigo. `parseMoney`
    // entende milhar e devolve null quando não dá pra ler — aí é erro na tela,
    // nunca zero calado.
    const valueRaw = String(formData.get("value") ?? "").trim();
    const value = valueRaw ? parseMoney(valueRaw) : 0;
    if (value === null || value < 0) {
        return { error: "Valor do pedido inválido. Escreva assim: 12,50" };
    }

    if (await existeCorridaIgualRecente(me.id, address, 5)) {
        return { error: "Entrega já adicionada recentemente." };
    }

    const geoOpts = await loadGeocodeOpts(me.id);
    let lat = 0, lng = 0;
    let geoPrecision: string | null = null;
    try {
        const coords = await geocodeAddress(address, geoOpts);
        if (coords) { lat = coords.lat; lng = coords.lng; geoPrecision = coords.precision; }
    } catch (e) {
        console.error("Geocode form failed", e);
    }

    const { canCreateDelivery } = await import("@/lib/planLimits");
    const limitCheck = await canCreateDelivery(me.id);

    if (!limitCheck.allowed) {
        return { error: limitCheck.reason || "Limite de entregas atingido." };
    }

    const agora = new Date().toISOString();
    await db.insert(deliveries).values({
        shopkeeperId: me.id,
        address,
        customerName,
        value,
        observation,
        lat,
        lng,
        geoPrecision,
        status: "pending",
        stopOrder: 999,
        publicToken: newTrackingToken(),
        // Data sempre em ISO: o CURRENT_TIMESTAMP do banco grava noutro formato
        // e as duas formas juntas quebravam comparação e ordenação.
        createdAt: agora,
        updatedAt: agora,
    });

    // Fire-and-forget: push fora do ar não pode travar o cadastro
    pushToMotoboys({
        title: "🏍️ Nova Corrida Disponível!",
        body: address,
        url: "/app",
        tag: "nova-corrida",
    }).catch(() => { });

    revalidatePath("/app");
    return { success: true };
}

export async function optimizeSelectedRouteAction(selectedIds: number[]) {
    const auth = await getAuthUserWithRole(["shopkeeper", "motoboy", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!selectedIds?.length) {
        return { error: "Selecione pelo menos uma entrega." };
    }

    const cleanIds = selectedIds.filter(n => Number.isInteger(n) && n > 0);
    if (!cleanIds.length) return { error: "IDs inválidos." };

    const targets = await db.select().from(deliveries).where(inArray(deliveries.id, cleanIds));

    const visible = targets.filter(d =>
        me.role === "admin" ||
        (me.role === "shopkeeper" && d.shopkeeperId === me.id) ||
        (me.role === "motoboy" && (d.motoboyId === me.id || d.status === "pending"))
    );

    if (!visible.length) return { error: "Nenhuma entrega autorizada para você." };

    // Cachear opts por shopkeeperId pra não buscar shopSettings várias vezes
    const optsCache = new Map<number, GeocodeOpts>();
    async function optsFor(shopId: number | null): Promise<GeocodeOpts | undefined> {
        if (shopId == null) return undefined;
        const cached = optsCache.get(shopId);
        if (cached) return cached;
        const fresh = await loadGeocodeOpts(shopId);
        optsCache.set(shopId, fresh);
        return fresh;
    }

    const points = await Promise.all(visible.map(async (d, index) => {
        let lat = d.lat || 0;
        let lng = d.lng || 0;

        if (lat === 0 || lng === 0) {
            const opts = await optsFor(d.shopkeeperId);
            const coords = await geocodeAddress(d.address, opts);
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
                await db.update(deliveries).set({ lat, lng }).where(eq(deliveries.id, d.id));
            }
        }

        return { id: d.id, index, lat, lng, address: d.address };
    }));

    const validPoints = points.filter(p => p.lat !== 0);

    let optimized: typeof validPoints = [];
    if (validPoints.length > 0) {
        optimized = optimizeRoute(validPoints[0], validPoints);
    } else {
        optimized = points;
    }

    const failedPoints = points.filter(p => p.lat === 0);
    const finalOrder = [...optimized, ...failedPoints];

    await Promise.all(finalOrder.map((p, i) =>
        db.update(deliveries).set({ stopOrder: i + 1 }).where(eq(deliveries.id, p.id!))
    ));

    revalidatePath("/app");

    if (finalOrder.length > 0) {
        const destination = finalOrder[finalOrder.length - 1].address;
        const waypoints = finalOrder.slice(0, -1).map(p => p.address).join("|");
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}`;
        return { success: true, url };
    }

    return { success: true, url: "" };
}

export async function deleteDeliveryAction(id: number) {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido" };

    const del = await db.query.deliveries.findFirst({ where: eq(deliveries.id, id) });
    if (!del) return { error: "Entrega não encontrada" };

    const canDelete =
        me.role === "admin" ||
        (me.role === "shopkeeper" && del.shopkeeperId === me.id);

    if (!canDelete) return { error: "Sem permissão para excluir esta entrega." };

    try {
        await db.delete(deliveries).where(eq(deliveries.id, id));
        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[DELETE ERROR]", e);
        return { error: "Erro ao excluir. Verifique se existem registros associados." };
    }
}

export async function acceptDeliveryAction(id: number) {
    const auth = await getAuthUserWithRole(["motoboy", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido" };

    try {
        const delivery = await db.query.deliveries.findFirst({
            where: and(eq(deliveries.id, id), eq(deliveries.status, "pending")),
        });

        if (!delivery) return { error: "Entrega não disponível ou já foi aceita." };
        if (delivery.motoboyId) return { error: "Esta entrega já foi aceita por outro motoboy." };

        // `.returning()` + `motoboy_id IS NULL`: se outro motoboy pegou primeiro,
        // o UPDATE não muda nada e quem perdeu precisa SABER disso. Antes a tela
        // recarregava sem erro e ele saía atrás de um pedido que não era dele.
        const pegou = await db.update(deliveries)
            .set({
                motoboyId: me.id,
                status: "assigned",
                acceptedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .where(and(
                eq(deliveries.id, id),
                eq(deliveries.status, "pending"),
                isNull(deliveries.motoboyId),
            ))
            .returning({ id: deliveries.id });

        if (!pegou.length) {
            revalidatePath("/app");
            return { error: "Outro motoboy pegou essa corrida." };
        }

        if (delivery.shopkeeperId) {
            pushToUser(delivery.shopkeeperId, {
                title: "📦 Corrida aceita",
                body: `${me.name} aceitou a entrega #${id}`,
                url: "/app",
                tag: `entrega-${id}`,
            }).catch(() => { });
        }

        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[ACCEPT ERROR]", e);
        return { error: "Erro ao aceitar entrega." };
    }
}

export async function pickupDeliveryAction(id: number) {
    const auth = await getAuthUserWithRole(["motoboy", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido" };

    try {
        const delivery = await db.query.deliveries.findFirst({
            where: and(
                eq(deliveries.id, id),
                eq(deliveries.motoboyId, me.id),
                eq(deliveries.status, "assigned")
            ),
        });

        if (!delivery) return { error: "Entrega não encontrada ou não atribuída a você." };

        await db.update(deliveries)
            .set({
                status: "picked_up",
                pickedUpAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .where(eq(deliveries.id, id));

        if (delivery.shopkeeperId) {
            pushToUser(delivery.shopkeeperId, {
                title: "🛵 Saiu para entrega",
                body: `${me.name} pegou o pedido da entrega #${id}`,
                url: "/app",
                tag: `entrega-${id}`,
            }).catch(() => { });
        }

        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[PICKUP ERROR]", e);
        return { error: "Erro ao marcar coleta." };
    }
}

export async function completeDeliveryAction(id: number, receipt?: DeliveryReceipt) {
    const auth = await getAuthUserWithRole(["motoboy", "shopkeeper", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido" };

    // Validar recebimento (opcional — entrega pode ser finalizada sem informar).
    // A regra mora em src/lib/receipt.ts, a mesma que a tela usa.
    let receivedAmount: number | null = null;
    let receivedMethod: RecebimentoValidado["method"] = null;
    let receiptNote: string | null = null;
    let receiptStatus: RecebimentoValidado["status"] | null = null;
    if (receipt) {
        const conferido = validarRecebimento(receipt);
        if ("error" in conferido) return conferido;
        receiptStatus = conferido.status;
        receivedAmount = conferido.amount;
        receivedMethod = conferido.method;
        receiptNote = conferido.note;
    }

    try {
        // Motoboy: só entregas atribuídas a ele. Lojista: só entregas da loja dele
        // (inclusive pending, caso ele mesmo tenha entregue). Admin: qualquer uma.
        const ownership =
            me.role === "motoboy" ? eq(deliveries.motoboyId, me.id) :
            me.role === "shopkeeper" ? eq(deliveries.shopkeeperId, me.id) :
            undefined;
        const openStatuses: ("pending" | "assigned" | "picked_up")[] = me.role === "motoboy"
            ? ["assigned", "picked_up"]
            : ["pending", "assigned", "picked_up"];

        const delivery = await db.query.deliveries.findFirst({
            where: and(
                eq(deliveries.id, id),
                ownership,
                inArray(deliveries.status, openStatuses)
            ),
            with: { shopkeeper: true },
        });

        if (!delivery) {
            const alreadyDelivered = await db.query.deliveries.findFirst({
                where: and(
                    eq(deliveries.id, id),
                    ownership,
                    eq(deliveries.status, "delivered")
                ),
            });
            if (alreadyDelivered) return { success: true, alreadyDelivered: true };
            return { error: "Entrega não encontrada, sem permissão ou em status inválido." };
        }

        const shopId = delivery.shopkeeperId;
        // Taxa combinada na corrida (PDV/conferência) vale mais que a regra geral da loja.
        let fee = delivery.fee && delivery.fee > 0 ? delivery.fee : 0;

        if (fee === 0 && shopId) {
            const settings = await db.query.shopSettings.findFirst({
                where: eq(shopSettings.userId, shopId),
                columns: {
                    remunerationModel: true, fixedValue: true, valuePerKm: true,
                    guaranteedMinimum: true, shopLat: true, shopLng: true,
                },
            });

            // É aqui que a corrida por km fecha: na entrega o pino já existe, então
            // dá pra medir loja → cliente. (No webhook do PDV ainda não dá.)
            fee = calcularTaxa(
                settings ?? null,
                distanciaDaLoja(settings?.shopLat, settings?.shopLng, delivery.lat, delivery.lng),
            );
        }

        // Marcar "entregue" e lançar o dinheiro acontece numa transação só
        // (src/lib/deliveryLedger.ts). Dois cliques ao mesmo tempo não creditam
        // duas vezes: a transação fecha a janela e o índice único é a tranca.
        const fechado = fecharCorridaNoBanco({
            deliveryId: id,
            motoboyId: delivery.motoboyId,
            shopkeeperId: shopId,
            customerName: delivery.customerName,
            fee,
            recibo: { receiptStatus, receivedAmount, receivedMethod, receiptNote },
            statusAbertos: openStatuses,
        });

        if (!fechado.ok) return { error: fechado.erro };
        if (fechado.jaEntregue) return { success: true, alreadyDelivered: true };

        if (delivery.shopkeeperId && delivery.shopkeeperId !== me.id) {
            const recebido =
                receiptStatus === "recebido" || receiptStatus === "valor_diferente"
                    ? ` — recebeu R$ ${(receivedAmount ?? 0).toFixed(2).replace(".", ",")} (${receivedMethod})`
                    : receiptStatus === "nao_recebido" ? " — NÃO recebeu do cliente"
                    : receiptStatus === "nada_a_receber" ? " — já estava pago"
                    : "";
            pushToUser(delivery.shopkeeperId, {
                title: "✅ Entrega concluída",
                body: `Entrega #${id} finalizada${recebido}`,
                url: "/deliveries/history",
                tag: `entrega-${id}`,
            }).catch(() => { });
        }

        revalidatePath("/app");

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://zapentregas.duckdns.org";
        return {
            success: true,
            // Pelo token público, nunca pelo id: com /review/<id> o cliente trocava
            // o número e lia as entregas dos outros. Entrega antiga sem token não
            // ganha link (é raro e some no próximo cadastro).
            reviewUrl: delivery.publicToken ? `${baseUrl}/review/${delivery.publicToken}` : null,
            customerPhone: delivery.customerPhone,
            customerName: delivery.customerName || "Cliente",
        };
    } catch (e) {
        console.error("[COMPLETE ERROR]", e);
        return { error: "Erro ao finalizar" };
    }
}
