"use server";

import { db } from "@/db";
import { deliveries, shopSettings, users } from "@/db/schema";
import { eq, inArray, and, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { geocodeAddress, optimizeRoute, type GeocodeOpts } from "@/lib/routeUtils";
import { getAuthUser, getAuthUserWithRole } from "@/lib/session";
import { carregarMotoboyGerenciado, motoboyEnxergaCorrida, motoboyScope } from "@/lib/team";
import { chargeModeDaCorrida, normalizarChargeMode, type ChargeMode } from "@/lib/chargeMode";
import { newTrackingToken } from "@/lib/trackingToken";
import { pushDeCorridaNova, pushToUser, pushDeCorridaDestinada } from "@/lib/push";
import { validarRecebimento, type DeliveryReceipt, type RecebimentoValidado } from "@/lib/receipt";
import { fecharCorridaNoBanco } from "@/lib/deliveryLedger";
import { planejarDestino } from "@/lib/deliveryAssign";
import { parseMoney } from "@/lib/money";
import { calcularTaxa, distanciaDaLoja } from "@/lib/fee";
import { existeCorridaIgualRecente } from "@/lib/deliveryGuards";
import { logServerError } from "@/lib/serverLog";
import { avisoDeCorridaNovaComNumero, resumoDoLocal } from "@/lib/deliveryPrivacy";
import { proximoNumeroDoDia } from "@/lib/dailySeq";
import { linkRota as montarLinkRota } from "@/lib/mapsLink";
import { montarNotaJustificada, motivoValido, AVISO_MOTIVO_CURTO } from "@/lib/geofence";
import { absoluteUrl } from "@/lib/appUrl";

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

/**
 * Motoboys ativos que ESTA loja gerencia (admin vê todos).
 *
 * Existe porque a tela de "Nova Rota" é toda client-side: sem isto ela não teria
 * como montar o campo "destinar a corrida a alguém". A regra de quem é da equipe
 * de quem continua sendo a mesma de sempre — `motoboyScope` em src/lib/team.ts.
 */
export async function listarMotoboysDaEquipeAction(): Promise<
    { motoboys: { id: number; name: string }[] } | { error: string }
> {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return auth;

    const lista = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(motoboyScope(auth.user))
        .orderBy(users.name);

    return { motoboys: lista };
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
    // "Já pago" zera o valor, como o antigo "é pra receber" desmarcado fazia.
    const chargeMode: ChargeMode = normalizarChargeMode(formData.get("chargeMode"), null);
    const valueRaw = String(formData.get("value") ?? "").trim();
    const valueLido = valueRaw ? parseMoney(valueRaw) : 0;
    if (valueLido === null || valueLido < 0) {
        return { error: "Valor do pedido inválido. Escreva assim: 12,50" };
    }
    const value = chargeMode === "pago" ? 0 : valueLido;

    // Destinar a corrida a um motoboy é opcional: vazio = fila aberta, como sempre.
    const motoboyIdBruto = String(formData.get("motoboyId") ?? "").trim();
    let destinatario: { id: number; name: string } | null = null;
    if (motoboyIdBruto) {
        const escolhido = await carregarMotoboyGerenciado(me, Number(motoboyIdBruto));
        if (!escolhido) return { error: "Esse motoboy não é da sua equipe." };
        destinatario = { id: escolhido.id, name: escolhido.name };
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
        await logServerError("geocode_cadastro_corrida", e, { userId: me.id, page: "/app", address });
    }

    const { canCreateDelivery } = await import("@/lib/planLimits");
    const limitCheck = await canCreateDelivery(me.id);

    if (!limitCheck.allowed) {
        return { error: limitCheck.reason || "Limite de entregas atingido." };
    }

    const agora = new Date().toISOString();
    // O "Corrida N" do dia e o INSERT na MESMA transação: dois pedidos entrando
    // ao mesmo tempo não podem receber o mesmo número (ver src/lib/dailySeq.ts).
    const criada = db.transaction((tx) => tx.insert(deliveries).values({
        shopkeeperId: me.id,
        dailySeq: proximoNumeroDoDia(tx, me.id, agora),
        // Destinada a alguém já nasce "aceita": o motoboy não precisa disputar
        // no pool uma corrida que a loja já deu pra ele.
        motoboyId: destinatario?.id ?? null,
        address,
        customerName,
        value,
        chargeMode,
        observation: destinatario
            ? [observation, `destinada pela loja a ${destinatario.name}`].filter(Boolean).join(" · ").slice(0, 1000)
            : observation,
        lat,
        lng,
        geoPrecision,
        status: destinatario ? "assigned" : "pending",
        acceptedAt: destinatario ? agora : null,
        stopOrder: 999,
        publicToken: newTrackingToken(),
        // Data sempre em ISO: o CURRENT_TIMESTAMP do banco grava noutro formato
        // e as duas formas juntas quebravam comparação e ordenação.
        createdAt: agora,
        updatedAt: agora,
    }).returning({ id: deliveries.id, dailySeq: deliveries.dailySeq }).get());

    // Fire-and-forget: push fora do ar não pode travar o cadastro.
    // Endereço com número é dado pessoal do cliente saindo do app pra um
    // aparelho que a loja não controla — nos dois casos vai só o bairro.
    if (destinatario) {
        // Corrida com dono não vira anúncio: só o escolhido é avisado.
        pushDeCorridaDestinada(destinatario.id, criada.id, resumoDoLocal(address), me.name, criada.dailySeq)
            .catch(() => { });
    } else {
        // Só quem pode VER essa corrida é avisado: loja no modo "equipe" não
        // anuncia pro app inteiro (regra única em src/lib/team.ts).
        pushDeCorridaNova(me.id, {
            title: "🏍️ Nova Corrida Disponível!",
            // "Corrida 7 · Centro · Uberaba" — o número é como a loja chama a
            // corrida no grupo; o bairro é o máximo que pode sair no push.
            body: avisoDeCorridaNovaComNumero(criada.dailySeq, address),
            url: "/app",
            tag: "nova-corrida",
        }).catch(() => { });
    }

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

    // Motoboy só reordena o que JÁ É DELE. Antes valia qualquer corrida com
    // status "pending", de qualquer loja: bastava mandar [1,2,3,...,500] e a
    // action devolvia os endereços completos de todas — e ainda renumerava a
    // ordem de parada da loja dos outros. Otimizar rota só faz sentido nas
    // corridas que a pessoa aceitou.
    const visible = targets.filter(d =>
        me.role === "admin" ||
        (me.role === "shopkeeper" && d.shopkeeperId === me.id) ||
        (me.role === "motoboy" && d.motoboyId === me.id)
    );

    if (!visible.length && me.role === "motoboy") {
        return { error: "Aceite as corridas primeiro — a rota é montada com as suas." };
    }

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
        // Montada com lat/lng quando existe (montarLinkRota decide ponto a ponto):
        // com o texto do endereço o Google geocodificava de novo e ignorava o pino
        // que o caixa tinha arrastado na tela de conferência.
        const url = montarLinkRota(finalOrder.map(p => ({ lat: p.lat, lng: p.lng, address: p.address })));
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
        await logServerError("excluir_corrida", e, { userId: me.id, page: "/app", deliveryId: id });
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

        // "Quem vê minhas corridas": no modo "equipe" só motoboy da loja pega.
        // A tela já esconde, mas a tela é só a primeira barreira — quem manda é
        // o servidor (a mesma função que monta a query em /app).
        // A sessão não carrega de que loja ele é: busca aqui.
        const vinculo = await db.query.users.findFirst({
            where: eq(users.id, me.id),
            columns: { shopkeeperId: true },
        });
        if (!(await motoboyEnxergaCorrida({ ...me, shopkeeperId: vinculo?.shopkeeperId ?? null }, delivery))) {
            return { error: "Essa corrida é só pros motoboys da loja." };
        }

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
        await logServerError("aceitar_corrida", e, { userId: me.id, page: "/app", deliveryId: id });
        return { error: "Erro ao aceitar entrega." };
    }
}

/**
 * A LOJA destina uma corrida a um motoboy (ou devolve pra fila).
 *
 * Até aqui só existia fila aberta: a loja cadastrava e torcia pra alguém pegar.
 * Com uma equipe fixa isso é ruim — o lojista sabe quem está livre.
 *
 * `motoboyId = null` devolve pra fila (status volta pra "pending" e a corrida
 * some da mão de quem estava com ela).
 *
 * Janela: só enquanto a corrida está "pending" ou "assigned". Depois que o
 * motoboy COLETOU o pedido (picked_up) ele já está com a mercadoria — trocar o
 * dono aí deixaria a corrida no nome de quem não está com o pacote.
 */
export async function assignDeliveryAction(id: number, motoboyId: number | null) {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido" };

    try {
        const ownership = me.role === "admin"
            ? eq(deliveries.id, id)
            : and(eq(deliveries.id, id), eq(deliveries.shopkeeperId, me.id));

        const delivery = await db.query.deliveries.findFirst({ where: ownership });
        if (!delivery) return { error: "Corrida não encontrada." };

        // Lojista só destina pra motoboy DELE (motoboyScope, via carregarMotoboyGerenciado).
        let escolhido: { id: number; name: string } | null = null;
        if (motoboyId != null) {
            const achado = await carregarMotoboyGerenciado(me, Number(motoboyId));
            if (!achado) return { error: "Esse motoboy não é da sua equipe." };
            if (achado.isActive === false) return { error: "Esse motoboy está desativado." };
            escolhido = { id: achado.id, name: achado.name };
        }

        // A decisão (janela, status, rastro na observação) mora em
        // src/lib/deliveryAssign.ts — lá ela é testável sem subir o servidor.
        const agora = new Date().toISOString();
        const plano = planejarDestino(delivery, escolhido, agora);
        if (!plano.ok) return { error: plano.erro };
        if (plano.jaEra) return { success: true, jaEra: true };

        // O WHERE repete a condição: se o motoboy coletar (ou outro lojista mexer)
        // entre a leitura e agora, nada é gravado.
        const mudou = await db.update(deliveries)
            .set({
                motoboyId: plano.motoboyId,
                status: plano.status,
                acceptedAt: plano.acceptedAt,
                observation: plano.observation,
                updatedAt: agora,
            })
            .where(and(
                eq(deliveries.id, id),
                inArray(deliveries.status, ["pending", "assigned"]),
            ))
            .returning({ id: deliveries.id });

        if (!mudou.length) return { error: "Essa corrida mudou de situação. Atualize a tela." };

        if (escolhido) {
            // Só o escolhido é avisado, e sem endereço/telefone no corpo.
            pushDeCorridaDestinada(escolhido.id, id, resumoDoLocal(delivery.address), me.name)
                .catch(() => { });
        } else if (delivery.motoboyId) {
            pushToUser(delivery.motoboyId, {
                title: "↩️ Corrida devolvida pra fila",
                body: `A loja tirou a corrida #${id} de você.`,
                url: "/app",
                tag: `entrega-${id}`,
            }).catch(() => { });
        }

        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[ASSIGN ERROR]", e);
        await logServerError("destinar_corrida", e, { userId: me.id, page: "/app", deliveryId: id });
        return { error: "Não consegui destinar a corrida agora. Tente de novo." };
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
        await logServerError("coletar_corrida", e, { userId: me.id, page: "/app", deliveryId: id });
        return { error: "Erro ao marcar coleta." };
    }
}

/**
 * Quando o motoboy finaliza LONGE do endereço (ou sem GPS), a tela manda junto o
 * motivo escrito e a distância medida. Isso vira um carimbo na observação da
 * corrida — sem coluna nova no banco — pra loja conferir depois.
 */
export type ContextoDeEntrega = {
    foraDoRaio?: boolean;
    motivo?: string;
    distanciaMetros?: number | null;
};

export async function completeDeliveryAction(
    id: number,
    receipt?: DeliveryReceipt,
    contexto?: ContextoDeEntrega,
    /**
     * Quem fez a entrega, escolhido pela LOJA na hora de finalizar. Só vale pra
     * lojista/admin: o motoboy finaliza a corrida dele e ponto. É obrigatório
     * quando a corrida não tem dono, porque a carteira precisa de um.
     */
    motoboyIdEscolhido?: number | null,
) {
    const auth = await getAuthUserWithRole(["motoboy", "shopkeeper", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido" };

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

        // Validar recebimento (opcional — entrega pode ser finalizada sem informar).
        // A regra mora em src/lib/receipt.ts, a mesma que a tela usa. Roda DEPOIS
        // de carregar a corrida porque o valor do pedido e o tipo de cobrança
        // ("a receber" × "a conferir" × "pago") fazem parte da régua.
        const modoCobranca = chargeModeDaCorrida(delivery);
        let receivedAmount: number | null = null;
        let receivedMethod: RecebimentoValidado["method"] = null;
        let receiptNote: string | null = null;
        let receiptStatus: RecebimentoValidado["status"] | null = null;
        if (receipt) {
            const conferido = validarRecebimento(receipt, delivery.value, modoCobranca);
            if ("error" in conferido) return conferido;
            receiptStatus = conferido.status;
            receivedAmount = conferido.amount;
            receivedMethod = conferido.method;
            receiptNote = conferido.note;
        }

        // Finalizou fora do raio: o motivo é obrigatório, e a mesma regra da tela
        // vale aqui (a tela é só a primeira barreira; quem manda é o servidor).
        if (contexto?.foraDoRaio) {
            if (!motivoValido(contexto.motivo)) return { error: AVISO_MOTIVO_CURTO };
            receiptNote = montarNotaJustificada(receiptNote, contexto.motivo!, contexto.distanciaMetros);
        }

        // ── Quem fez a entrega, quando quem fecha é a LOJA ──────────────────
        // A loja finaliza sem GPS e sem app de motoboy. Se a corrida não tem
        // dono, alguém precisa ser: crédito da taxa e débito do dinheiro têm que
        // cair numa carteira, senão o acerto do dia fica furado.
        let atribuirMotoboyId: number | null = null;
        if (me.role !== "motoboy") {
            if (motoboyIdEscolhido != null) {
                const escolhido = await carregarMotoboyGerenciado(me, Number(motoboyIdEscolhido));
                if (!escolhido) return { error: "Esse motoboy não é da sua equipe." };
                if (escolhido.id !== delivery.motoboyId) atribuirMotoboyId = escolhido.id;
            } else if (delivery.motoboyId == null) {
                return { error: "Escolha quem fez a entrega — a taxa e o dinheiro precisam de dono." };
            }
            // Rastro de quem fechou: sem isto, "entregue" sem motoboy no GPS
            // vira mistério no histórico.
            receiptNote = [receiptNote, `finalizada pela loja (${me.name})`]
                .filter(Boolean)
                .join(" · ")
                .slice(0, 500);
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
            atribuirMotoboyId,
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

        return {
            success: true,
            // Pelo token público, nunca pelo id: com /review/<id> o cliente trocava
            // o número e lia as entregas dos outros. Entrega antiga sem token não
            // ganha link (é raro e some no próximo cadastro).
            // absoluteUrl (e não NEXT_PUBLIC_BASE_URL): a imagem é construída na
            // máquina do Thon, então NEXT_PUBLIC_* já vem congelado do build.
            reviewUrl: delivery.publicToken ? absoluteUrl(`/review/${delivery.publicToken}`).toString() : null,
            customerPhone: delivery.customerPhone,
            customerName: delivery.customerName || "Cliente",
        };
    } catch (e) {
        console.error("[COMPLETE ERROR]", e);
        await logServerError("finalizar_corrida", e, { userId: me.id, page: "/app", deliveryId: id });
        return { error: "Erro ao finalizar" };
    }
}
