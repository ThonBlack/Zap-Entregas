/**
 * A "cerca" de 200 metros: a regra que decide se o motoboy está perto o
 * bastante do endereço pra finalizar a corrida.
 *
 * Antes o botão "Entregue" simplesmente FICAVA DESABILITADO fora do raio, sem
 * saída nenhuma: prédio com laje, ou pino que o geocodificador jogou no centro
 * do bairro, e o motoboy ficava com o cliente na frente sem conseguir fechar a
 * corrida. E, do outro lado, quando o GPS estava negado a cerca sumia em
 * silêncio — ninguém ficava sabendo.
 *
 * A regra nova: o botão nunca trava. Fora do raio (ou sem GPS) ele pede uma
 * confirmação a mais com o motivo escrito, e esse motivo fica gravado na corrida
 * pra loja conferir depois.
 */

/** Distância a partir da qual a gente pede explicação. */
export const RAIO_ENTREGA_METROS = 200;

/** Motivo curto demais não explica nada — pede pelo menos isso. */
export const MOTIVO_MINIMO = 5;

export type SituacaoCerca =
    /** Está pertinho: finaliza direto. */
    | { tipo: "dentro"; distanciaMetros: number }
    /** Longe do endereço: finaliza, mas explicando. */
    | { tipo: "fora"; distanciaMetros: number }
    /** GPS negado/desligado: não dá pra saber, então também explica. */
    | { tipo: "sem-gps" }
    /** A corrida não tem coordenada (endereço nunca foi geocodificado). */
    | { tipo: "sem-coordenada" };

export function calcularDistanciaMetros(
    lat1: number, lng1: number, lat2: number, lng2: number,
): number {
    const R = 6371e3; // raio da Terra em metros
    const f1 = (lat1 * Math.PI) / 180;
    const f2 = (lat2 * Math.PI) / 180;
    const df = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Onde o motoboy está em relação ao endereço da corrida.
 *
 * `gpsDisponivel = false` quer dizer que a permissão foi negada ou o aparelho
 * não devolveu posição — é diferente de "a corrida não tem pino".
 */
export function avaliarCerca(params: {
    /** Vale só pro motoboy: lojista finaliza de onde estiver. */
    aplicar: boolean;
    gpsDisponivel: boolean;
    posicao: { lat: number; lng: number } | null;
    destino: { lat: number | null; lng: number | null };
    raioMetros?: number;
}): SituacaoCerca {
    const raio = params.raioMetros ?? RAIO_ENTREGA_METROS;

    // Lojista/admin: a cerca não se aplica, então nunca há o que justificar.
    if (!params.aplicar) return { tipo: "dentro", distanciaMetros: 0 };

    const { lat, lng } = params.destino;
    // lat/lng zerados = endereço que o geocodificador não achou.
    if (!lat || !lng) return { tipo: "sem-coordenada" };

    if (!params.gpsDisponivel || !params.posicao) return { tipo: "sem-gps" };

    const d = calcularDistanciaMetros(params.posicao.lat, params.posicao.lng, lat, lng);
    return d <= raio ? { tipo: "dentro", distanciaMetros: d } : { tipo: "fora", distanciaMetros: d };
}

/** Precisa da confirmação extra com motivo escrito? */
export function precisaJustificar(s: SituacaoCerca): boolean {
    return s.tipo === "fora" || s.tipo === "sem-gps";
}

/** "2,2 km" / "180 m" — distância que qualquer pessoa entende. */
export function distanciaLegivel(metros: number): string {
    return metros >= 1000
        ? `${(metros / 1000).toFixed(1).replace(".", ",")} km`
        : `${Math.round(metros)} m`;
}

/** A pergunta que o motoboy lê na confirmação extra. */
export function perguntaDaCerca(s: SituacaoCerca): string {
    if (s.tipo === "fora") {
        return `Você está a ${distanciaLegivel(s.distanciaMetros)} do endereço. Finalizar mesmo assim?`;
    }
    if (s.tipo === "sem-gps") {
        return "Não consegui ver sua localização (GPS desligado ou sem permissão). Finalizar mesmo assim?";
    }
    return "Finalizar esta entrega?";
}

/**
 * O carimbo que vai na frente do motivo, dentro de `receipt_note`.
 * Fica em texto mesmo — assim a loja lê no histórico sem coluna nova no banco.
 */
export function prefixoDaJustificativa(distanciaMetros: number | null | undefined): string {
    return distanciaMetros != null && Number.isFinite(distanciaMetros) && distanciaMetros > 0
        ? `[fora do raio ${distanciaLegivel(distanciaMetros)}] `
        : "[sem GPS] ";
}

/**
 * Junta o carimbo, o motivo do motoboy e a observação que ele já tinha escrito
 * no modal. Devolve `null` quando não sobra nada (não deveria acontecer).
 */
export function montarNotaJustificada(
    notaOriginal: string | null | undefined,
    motivo: string,
    distanciaMetros: number | null | undefined,
): string | null {
    const limpo = (motivo ?? "").trim();
    const base = `${prefixoDaJustificativa(distanciaMetros)}${limpo}`;
    const extra = (notaOriginal ?? "").trim();
    const junto = extra ? `${base} — ${extra}` : base;
    return junto.trim() ? junto.slice(0, 500) : null;
}

/** O motivo escrito serve? Mesma regra na tela e no servidor. */
export function motivoValido(motivo: string | null | undefined): boolean {
    return typeof motivo === "string" && motivo.trim().length >= MOTIVO_MINIMO;
}

export const AVISO_MOTIVO_CURTO =
    "Escreva rapidinho o motivo (pelo menos 5 letras) — a loja precisa entender depois.";
