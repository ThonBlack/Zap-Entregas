import "server-only";

import { db } from "@/db";
import { shopSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { geocodeAddress, type GeocodeOpts } from "@/lib/routeUtils";

/**
 * Onde fica o pino depois que alguém CORRIGIU uma corrida já liberada.
 *
 * Parece detalhe e não é: errar aqui manda o motoboy pro lugar errado, ou pior,
 * grava o endereço da LOJA como destino "exato" e o botão "Entregue" trava na
 * casa do cliente (a cerca mede a distância até o ponto gravado).
 *
 * A régua, na ordem:
 *  1. a pessoa ARRASTOU o pino → é ele que vale, e a precisão vira "exata";
 *  2. senão, se o endereço mudou (ou não havia ponto), o ponto antigo não serve
 *     mais: procura de novo no mapa;
 *  3. se a busca falhar mas o pino que veio da tela for utilizável, fica com
 *     ele — melhor um ponto aproximado do que 0,0 no meio do oceano.
 *
 * Mora aqui porque a mesma correção acontece por duas portas: o lojista logado
 * em /deliveries/[id]/editar e o vendedor na Fila da loja, dentro do EpicStore.
 */

export type PontoEditado = {
    lat: number;
    lng: number;
    geoPrecision: string | null;
};

export async function resolverPontoEditado(params: {
    /** A loja da corrida — dá o viés de cidade pra busca do endereço. */
    shopkeeperId: number | null;
    /** Endereço que está sendo salvo agora. */
    address: string;
    /** Endereço como estava gravado antes desta edição. */
    enderecoAnterior: string;
    geoPrecisionAnterior: string | null;
    /** Alguém encostou no pino do mapa nesta edição? */
    pinTouched: boolean;
    /** O que o mapa da tela mandou (pode ser lixo, é conferido aqui). */
    lat: number;
    lng: number;
    /** Nome da tela, só pro console quando a busca falhar. */
    origem: string;
}): Promise<PontoEditado> {
    const { shopkeeperId, address, enderecoAnterior, geoPrecisionAnterior, pinTouched, origem } = params;

    let lat = params.lat;
    let lng = params.lng;
    const pinValid = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    const enderecoMudou = address !== enderecoAnterior;

    let geoPrecision: string | null = geoPrecisionAnterior ?? null;

    if (pinTouched && pinValid) {
        // Só é "exata" quando uma PESSOA colocou o pino no lugar.
        return { lat, lng, geoPrecision: "exata" };
    }

    if (!enderecoMudou && pinValid) {
        // Nada mudou que justifique gastar uma busca paga no Google.
        return { lat, lng, geoPrecision };
    }

    lat = 0; lng = 0;
    geoPrecision = null;
    try {
        const s = await db.query.shopSettings.findFirst({
            where: eq(shopSettings.userId, shopkeeperId ?? -1),
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
        console.error(`[${origem}] geocode falhou:`, e);
    }

    // Busca falhou mas o pino que veio da tela é válido: melhor ele do que 0,0.
    if (lat === 0 && lng === 0 && pinValid) {
        return {
            lat: params.lat,
            lng: params.lng,
            geoPrecision: geoPrecisionAnterior ?? null,
        };
    }

    return { lat, lng, geoPrecision };
}
