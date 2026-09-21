import "server-only";

import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { geocodeAddress, type GeocodeOpts } from "@/lib/routeUtils";
import { existeCorridaIgualRecente } from "@/lib/deliveryGuards";
import { proximoNumeroDoDia } from "@/lib/dailySeq";
import { newTrackingToken } from "@/lib/trackingToken";
import { logServerError } from "@/lib/serverLog";
import type { ChargeMode } from "@/lib/chargeMode";

/**
 * Nascer uma corrida no banco — o miolo, num lugar só.
 *
 * Por que existe: a corrida nasce por portas diferentes (o lojista logado em
 * /app, agora o vendedor na Fila da loja, amanhã outra). Cada porta tem a sua
 * conversa — quem está autorizado, que campos a tela tem, quem é avisado — mas
 * o MIOLO é sempre o mesmo e é cheio de detalhe que já custou caro:
 *
 *   1. trava de duplo clique (src/lib/deliveryGuards.ts);
 *   2. procurar o endereço no mapa com o viés da cidade da loja;
 *   3. conferir o limite do plano ANTES de gravar;
 *   4. o "Corrida N" do dia e o INSERT na MESMA transação, senão dois pedidos
 *      simultâneos viram dois "Corrida 7" (src/lib/dailySeq.ts).
 *
 * A ORDEM acima é a que estava em addDeliveryAction e foi mantida de propósito:
 * checar duplicata antes do geocode economiza uma busca PAGA no Google a cada
 * duplo clique.
 *
 * O que NÃO está aqui: quem pode criar, de quem é a loja e quem recebe o aviso
 * (push). Isso muda de porta pra porta e fica com quem chamou.
 */

export type DadosDaNovaCorrida = {
    /** A loja dona da corrida — já conferida por quem chamou. */
    shopkeeperId: number;
    address: string;
    customerName?: string | null;
    customerPhone?: string | null;
    observation?: string | null;
    chargeMode: ChargeMode;
    /** Já em número, e já zerado quando a cobrança é "pago". */
    value: number;
    /** Dono da corrida, quando a loja destinou a alguém. Vazio = fila aberta. */
    motoboyId?: number | null;
    /** Carimbo da corrida (ISO em UTC). Lançamento atrasado manda o dia dela. */
    quandoISO: string;
    /** Quantos minutos pra trás a trava de "corrida igual" olha. */
    janelaDuplicataMin?: number;
    /** Nome da tela, só pro registro de erro do geocode. */
    origem: string;
};

export type ResultadoDaNovaCorrida =
    | { ok: true; id: number; dailySeq: number | null }
    | { ok: false; erro: string };

async function opcoesDeGeocode(shopkeeperId: number): Promise<GeocodeOpts> {
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

export async function criarCorridaDaLoja(
    dados: DadosDaNovaCorrida,
): Promise<ResultadoDaNovaCorrida> {
    const {
        shopkeeperId, address, customerName = null, customerPhone = null,
        observation = null, chargeMode, value, motoboyId = null,
        quandoISO, janelaDuplicataMin = 5, origem,
    } = dados;

    if (await existeCorridaIgualRecente(shopkeeperId, address, janelaDuplicataMin)) {
        return { ok: false, erro: "Entrega já adicionada recentemente." };
    }

    let lat = 0, lng = 0;
    let geoPrecision: string | null = null;
    try {
        const coords = await geocodeAddress(address, await opcoesDeGeocode(shopkeeperId));
        if (coords) { lat = coords.lat; lng = coords.lng; geoPrecision = coords.precision; }
    } catch (e) {
        // Sem pino a corrida continua válida: a tela avisa "não achei esse
        // endereço" e alguém arrasta o pino na mão.
        console.error("Geocode form failed", e);
        await logServerError("geocode_cadastro_corrida", e, { userId: shopkeeperId, page: origem, address });
    }

    const { canCreateDelivery } = await import("@/lib/planLimits");
    const limite = await canCreateDelivery(shopkeeperId);
    if (!limite.allowed) {
        return { ok: false, erro: limite.reason || "Limite de entregas atingido." };
    }

    const criada = db.transaction((tx) => tx.insert(deliveries).values({
        shopkeeperId,
        dailySeq: proximoNumeroDoDia(tx, shopkeeperId, quandoISO),
        // Destinada a alguém já nasce "aceita": o motoboy não precisa disputar
        // no pool uma corrida que a loja já deu pra ele.
        motoboyId,
        address,
        customerName,
        customerPhone,
        value,
        chargeMode,
        observation,
        lat,
        lng,
        geoPrecision,
        status: motoboyId ? "assigned" : "pending",
        acceptedAt: motoboyId ? quandoISO : null,
        stopOrder: 999,
        publicToken: newTrackingToken(),
        // Data sempre em ISO: o CURRENT_TIMESTAMP do banco grava noutro formato
        // e as duas formas juntas quebravam comparação e ordenação.
        createdAt: quandoISO,
        updatedAt: quandoISO,
    }).returning({ id: deliveries.id, dailySeq: deliveries.dailySeq }).get());

    return { ok: true, id: criada.id, dailySeq: criada.dailySeq };
}
