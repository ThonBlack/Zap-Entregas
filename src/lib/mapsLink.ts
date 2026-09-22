/**
 * Endereços de navegação usados pelo motoboy (Google Maps e Waze).
 *
 * O ponto importante: quando a corrida TEM coordenada (o caixa arrastou o pino
 * na tela de conferência), o link vai com `lat,lng`. Antes ia só o texto do
 * endereço e o Google geocodificava de novo por conta própria — jogando fora o
 * ajuste que alguém fez na mão e, às vezes, mandando o motoboy pra outra rua.
 *
 * A rota inteira (`linkRota`) continua só no Google Maps: o Waze não aceita
 * várias paradas num link só.
 */

export type PontoDeEntrega = {
    lat?: number | null;
    lng?: number | null;
    address: string;
};

/** Coordenada de verdade? 0/null é o que o banco guarda quando não achou o endereço. */
export function temCoordenada(p: PontoDeEntrega): boolean {
    return (
        typeof p.lat === "number" && typeof p.lng === "number" &&
        Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
        p.lat !== 0 && p.lng !== 0
    );
}

/** "-19.75,-47.93" quando dá, senão o endereço escrito. */
export function alvoDoMaps(p: PontoDeEntrega): string {
    return temCoordenada(p) ? `${p.lat},${p.lng}` : p.address;
}

/** Link de navegação de UMA entrega (o botão "Navegar" do card). */
export function linkNavegacao(p: PontoDeEntrega): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(alvoDoMaps(p))}`;
}

/**
 * Link de navegação de UMA entrega no Waze.
 *
 * Com pino vai em `ll=lat,lng`; sem pino vai em `q=endereço` (aí o Waze procura
 * o endereço sozinho). `navigate=yes` já começa a rota, sem parar na tela de
 * "ver no mapa".
 */
export function linkWaze(p: PontoDeEntrega): string {
    const alvo = encodeURIComponent(alvoDoMaps(p));
    const campo = temCoordenada(p) ? "ll" : "q";
    return `https://waze.com/ul?${campo}=${alvo}&navigate=yes`;
}

/** Com qual aplicativo o motoboy quer navegar. */
export type AppDeNavegacao = "maps" | "waze";

/** Nome que aparece na tela pro motoboy. */
export const NOME_DO_APP: Record<AppDeNavegacao, string> = {
    maps: "Google Maps",
    waze: "Waze",
};

/** Mesmo endereço, no aplicativo que o motoboy escolheu. */
export function linkNavegacaoEm(app: AppDeNavegacao, p: PontoDeEntrega): string {
    return app === "waze" ? linkWaze(p) : linkNavegacao(p);
}

/**
 * Link da rota inteira: a última parada vira o destino e as outras viram
 * paradas no meio ("waypoints"), na ordem que a otimização escolheu.
 */
export function linkRota(pontos: PontoDeEntrega[]): string {
    if (!pontos.length) return "";
    const destino = alvoDoMaps(pontos[pontos.length - 1]);
    const paradas = pontos.slice(0, -1).map(alvoDoMaps);
    const base = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
    return paradas.length ? `${base}&waypoints=${encodeURIComponent(paradas.join("|"))}` : base;
}
