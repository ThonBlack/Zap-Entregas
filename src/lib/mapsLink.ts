/**
 * Endereços do Google Maps usados pelo motoboy.
 *
 * O ponto importante: quando a corrida TEM coordenada (o caixa arrastou o pino
 * na tela de conferência), o link vai com `lat,lng`. Antes ia só o texto do
 * endereço e o Google geocodificava de novo por conta própria — jogando fora o
 * ajuste que alguém fez na mão e, às vezes, mandando o motoboy pra outra rua.
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
