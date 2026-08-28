/**
 * Carrega o script do mapa do Google sob demanda (uma vez por página).
 *
 * Nada de biblioteca extra: é uma tag <script> com callback, o mesmo que o
 * @googlemaps/js-api-loader faz, sem somar peso ao pacote.
 *
 * Aqui só existem os tipos que a gente realmente usa — instalar @types/google.maps
 * traria um namespace global inteiro pra três telas.
 */

export interface GPonto {
    lat(): number;
    lng(): number;
}

export interface GPontoLiteral {
    lat: number;
    lng: number;
}

export interface GEventoMouse {
    latLng?: GPonto | null;
}

export interface GOuvinte {
    remove(): void;
}

export interface GMapa {
    setCenter(p: GPontoLiteral): void;
    setZoom(z: number): void;
    getZoom(): number | undefined;
    addListener(evento: string, fn: (e: GEventoMouse) => void): GOuvinte;
}

export interface GMarcador {
    setPosition(p: GPontoLiteral): void;
    getPosition(): GPonto | undefined;
    setMap(mapa: GMapa | null): void;
    addListener(evento: string, fn: () => void): GOuvinte;
}

export interface GoogleMapsApi {
    Map: new (el: HTMLElement, opcoes: Record<string, unknown>) => GMapa;
    Marker: new (opcoes: Record<string, unknown>) => GMarcador;
    Size: new (largura: number, altura: number) => unknown;
    Point: new (x: number, y: number) => unknown;
    SymbolPath: { CIRCLE: number };
}

interface JanelaComGoogle extends Window {
    google?: { maps?: GoogleMapsApi };
    gm_authFailure?: () => void;
    __zapMapaPronto?: () => void;
}

const ID_DO_SCRIPT = "google-maps-js-api";

let promessa: Promise<GoogleMapsApi> | null = null;
let chaveEmUso: string | null = null;
let chaveRecusada = false;
const ouvintesDeRecusa = new Set<() => void>();

/** Chave inválida/sem permissão pro site: nem adianta tentar de novo nesta sessão. */
export function chaveDoGoogleFoiRecusada(): boolean {
    return chaveRecusada;
}

/**
 * O Google só avisa que a chave é inválida DEPOIS que o mapa tenta desenhar,
 * chamando window.gm_authFailure. É esse o gancho que derruba a gente pro Leaflet.
 */
export function aoRecusarChaveDoGoogle(callback: () => void): () => void {
    ouvintesDeRecusa.add(callback);
    return () => { ouvintesDeRecusa.delete(callback); };
}

function marcarRecusa() {
    chaveRecusada = true;
    promessa = null;
    for (const cb of ouvintesDeRecusa) {
        try { cb(); } catch { /* um ouvinte quebrado não pode travar os outros */ }
    }
}

export function carregarGoogleMaps(chave: string, limiteMs = 10_000): Promise<GoogleMapsApi> {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("Mapa do Google só carrega no navegador"));
    }
    if (!chave) {
        return Promise.reject(new Error("Sem chave do navegador pro mapa do Google"));
    }
    if (chaveRecusada) {
        return Promise.reject(new Error("Chave do mapa recusada pelo Google"));
    }

    const janela = window as unknown as JanelaComGoogle;

    if (janela.google?.maps) return Promise.resolve(janela.google.maps);
    if (promessa && chaveEmUso === chave) return promessa;

    chaveEmUso = chave;
    promessa = new Promise<GoogleMapsApi>((resolve, reject) => {
        // Um mapa recusado derruba TODOS os mapas da página pro Leaflet.
        janela.gm_authFailure = () => marcarRecusa();

        const relogio = setTimeout(() => {
            promessa = null;
            reject(new Error("O mapa do Google demorou demais pra carregar"));
        }, limiteMs);

        const pronto = () => {
            clearTimeout(relogio);
            const maps = (window as unknown as JanelaComGoogle).google?.maps;
            if (maps) resolve(maps);
            else { promessa = null; reject(new Error("Script do Google carregou sem a API de mapas")); }
        };

        const jaExiste = document.getElementById(ID_DO_SCRIPT);
        if (jaExiste) {
            // Outra montagem já pediu o script: só espera o callback global.
            janela.__zapMapaPronto = pronto;
            return;
        }

        janela.__zapMapaPronto = pronto;

        const script = document.createElement("script");
        script.id = ID_DO_SCRIPT;
        script.async = true;
        const params = new URLSearchParams({
            key: chave,
            callback: "__zapMapaPronto",
            language: "pt-BR",
            region: "BR",
            loading: "async",
            v: "weekly",
        });
        script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
        script.onerror = () => {
            clearTimeout(relogio);
            script.remove();
            promessa = null;
            reject(new Error("Não deu pra baixar o mapa do Google (rede?)"));
        };
        document.head.appendChild(script);
    });

    return promessa;
}
