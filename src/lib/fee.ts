import { distanceKm } from "@/lib/routeUtils";

/**
 * Quanto o motoboy ganha por uma corrida, segundo a regra que a loja escolheu
 * em Configurações.
 *
 * Antes só "Taxa Fixa" era calculada de verdade: quem escolhia "Por KM" via a
 * tela salvar o valor por quilômetro e fechava o mês inteiro com R$ 0,00 na
 * carteira do motoboy — sem nenhum aviso. O "Mínimo Garantido" também era
 * salvo e nunca aplicado.
 *
 * Os nomes vêm do banco (`shop_settings.remuneration_model`):
 *   fixed    → taxa fixa por entrega
 *   distance → valor por km rodado da loja até o cliente
 *   hybrid   → taxa fixa de saída + valor por km
 *   daily    → APOSENTADO (ver `MODELO_APOSENTADO` abaixo)
 */

export type ModeloDeRemuneracao = "fixed" | "distance" | "daily" | "hybrid";

/**
 * "Diária" saiu da tela: pagar por dia não é uma conta por corrida, e do jeito
 * que estava toda corrida fechava em R$ 0,00. Loja que ficou com `daily`
 * gravado é tratada como "Taxa Fixa" (e a tela de Configurações avisa isso).
 */
export const MODELO_APOSENTADO: ModeloDeRemuneracao = "daily";

export type RegraDaLoja = {
    remunerationModel: ModeloDeRemuneracao | string | null;
    fixedValue: number | null;
    valuePerKm: number | null;
    guaranteedMinimum: number | null;
};

/** Modelo que vale de fato — "daily" cai em "fixed". */
export function modeloEfetivo(modelo: ModeloDeRemuneracao | string | null): ModeloDeRemuneracao {
    if (modelo === "distance" || modelo === "hybrid") return modelo;
    return "fixed";
}

/**
 * A regra da loja depende de saber a distância? Serve pro webhook do PDV, onde
 * a corrida nasce sem pino no mapa: nesses modelos ele deixa a taxa em 0 e quem
 * calcula é `completeDeliveryAction`, na entrega, com o pino já no lugar.
 */
export function dependeDaDistancia(modelo: ModeloDeRemuneracao | string | null): boolean {
    const efetivo = modeloEfetivo(modelo);
    return efetivo === "distance" || efetivo === "hybrid";
}

function arredonda(n: number): number {
    return Math.round(n * 100) / 100;
}

function numero(n: number | null | undefined): number {
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Calcula a taxa da corrida.
 *
 * `distanciaKm` é a distância da loja até o cliente. Vem `null` quando ainda
 * não dá pra saber (corrida do PDV sem pino no mapa, ou loja sem coordenada
 * cadastrada) — aí os modelos por km caem na taxa fixa, que é o que a loja tem
 * de mais próximo de um combinado.
 */
export function calcularTaxa(regra: RegraDaLoja | null | undefined, distanciaKm: number | null): number {
    if (!regra) return 0;

    const fixo = numero(regra.fixedValue);
    const porKm = numero(regra.valuePerKm);
    const minimo = numero(regra.guaranteedMinimum);
    const km = typeof distanciaKm === "number" && Number.isFinite(distanciaKm) && distanciaKm >= 0
        ? distanciaKm
        : null;

    let taxa: number;
    switch (modeloEfetivo(regra.remunerationModel)) {
        case "distance":
            // Sem distância não dá pra multiplicar: vale a taxa fixa como piso combinado.
            taxa = km === null ? fixo : porKm * km;
            break;
        case "hybrid":
            taxa = fixo + (km === null ? 0 : porKm * km);
            break;
        default:
            taxa = fixo;
    }

    // Mínimo garantido é piso, não soma.
    if (minimo > 0 && taxa < minimo) taxa = minimo;

    return arredonda(taxa);
}

/**
 * Distância loja → cliente, quando as duas pontas têm coordenada.
 * `0` de latitude/longitude aqui significa "não geocodificado", não o Atlântico.
 */
export function distanciaDaLoja(
    shopLat: number | null | undefined,
    shopLng: number | null | undefined,
    lat: number | null | undefined,
    lng: number | null | undefined,
): number | null {
    if (shopLat == null || shopLng == null || lat == null || lng == null) return null;
    if (shopLat === 0 || shopLng === 0 || lat === 0 || lng === 0) return null;
    return distanceKm(shopLat, shopLng, lat, lng);
}
