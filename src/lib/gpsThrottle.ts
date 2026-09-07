/**
 * Quando vale a pena mandar a posição do motoboy pro servidor.
 *
 * Com alta precisão o Android chama o app de 1 em 1 segundo. Cada chamada
 * virava um POST: numa jornada de 8 horas dava dezenas de milhares de
 * requisições, comendo bateria e o dado do plano dele — e o rastreio do cliente
 * não precisa de nada disso.
 *
 * Agora só manda quando as DUAS coisas forem verdade: passaram 15 segundos E
 * ele andou 30 metros. Parado no semáforo não gera tráfego nenhum.
 */

export const INTERVALO_MINIMO_MS = 15_000;
export const DISTANCIA_MINIMA_METROS = 30;

export type PosicaoEnviada = { lat: number; lng: number; quando: number } | null;

export function deveEnviarPosicao(params: {
    ultimoEnvio: PosicaoEnviada;
    agora: number;
    nova: { lat: number; lng: number };
    /** Injetável pra teste; por padrão a fórmula de Haversine do projeto. */
    distancia?: (aLat: number, aLng: number, bLat: number, bLng: number) => number;
    intervaloMs?: number;
    distanciaMinima?: number;
}): boolean {
    const { ultimoEnvio, agora, nova } = params;

    // Primeira leitura da sessão: manda sempre, senão a loja não vê ninguém no mapa.
    if (!ultimoEnvio) return true;

    const intervalo = params.intervaloMs ?? INTERVALO_MINIMO_MS;
    const minima = params.distanciaMinima ?? DISTANCIA_MINIMA_METROS;

    if (agora - ultimoEnvio.quando < intervalo) return false;

    const calc = params.distancia ?? distanciaHaversine;
    return calc(ultimoEnvio.lat, ultimoEnvio.lng, nova.lat, nova.lng) >= minima;
}

export function distanciaHaversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const R = 6371e3;
    const f1 = (aLat * Math.PI) / 180;
    const f2 = (bLat * Math.PI) / 180;
    const df = ((bLat - aLat) * Math.PI) / 180;
    const dl = ((bLng - aLng) * Math.PI) / 180;
    const h = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
