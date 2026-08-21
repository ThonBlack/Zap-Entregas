import { parseBrazilianAddress, normalizeStreet } from "@/lib/addressParser";

/**
 * Descobrir o ponto no mapa a partir do endereço escrito.
 *
 * Ordem de tentativa:
 *   1. Google (só se houver GOOGLE_MAPS_API_KEY) — é o único que acerta o número da
 *      casa no Brasil e entende ponto de referência ("Faculdade FAZU").
 *   2. OpenStreetMap com os campos separados (rua / cidade / UF / CEP) — de graça,
 *      acha a rua certa na maioria das vezes, mas raramente o número.
 *   3. ViaCEP pra corrigir o nome da rua pelo CEP e tentar o passo 2 de novo.
 *   4. Centro do bairro, e por último a cidade.
 *
 * Devolve junto o quanto o ponto é confiável, pra tela avisar quando for aproximado.
 */

export type GeocodePrecision = "exata" | "rua" | "bairro" | "cidade";

export interface GeocodeResult {
    lat: number;
    lng: number;
    precision: GeocodePrecision;
    provider: "google" | "osm" | "viacep+osm";
    formatted?: string;
}

export interface GeocodeOpts {
    defaultCity?: string | null;
    defaultState?: string | null;
    shopLat?: number | null;
    shopLng?: number | null;
    radiusKm?: number;
}

const NOMINATIM_UA = "ZapEntregas/1.0 (contato@zapentregas.duckdns.org)";

// O OpenStreetMap público permite 1 consulta por segundo. Estourar isso faz ele
// devolver vazio — foi por isso que o mesmo endereço às vezes achava e às vezes não.
let ultimaChamadaOsm = 0;
async function respeitarLimiteOsm(): Promise<void> {
    const agora = Date.now();
    const espera = 1100 - (agora - ultimaChamadaOsm);
    if (espera > 0) await new Promise(r => setTimeout(r, espera));
    ultimaChamadaOsm = Date.now();
}

// Endereço repetido (reenvio do PDV, otimização de rota) não precisa consultar de novo.
const cache = new Map<string, { valor: GeocodeResult | null; expira: number }>();
const CACHE_MS = 1000 * 60 * 60 * 24;

export function isGoogleGeocodingEnabled(): boolean {
    return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

export async function geocodeAddress(
    address: string,
    opts?: GeocodeOpts
): Promise<GeocodeResult | null> {
    if (!address?.trim()) return null;

    const chave = `${address.trim().toLowerCase()}|${opts?.defaultCity ?? ""}`;
    const emCache = cache.get(chave);
    if (emCache && emCache.expira > Date.now()) return emCache.valor;

    const resultado = await buscar(address, opts);
    cache.set(chave, { valor: resultado, expira: Date.now() + CACHE_MS });
    return resultado;
}

async function buscar(address: string, opts?: GeocodeOpts): Promise<GeocodeResult | null> {
    const p = parseBrazilianAddress(address);
    const city = p.city || opts?.defaultCity || null;
    const state = p.state || opts?.defaultState || null;

    // Quando só sobrou um pedaço além da rua, ele pode ser o bairro OU a cidade.
    const bairro = p.neighborhood && p.neighborhood.toLowerCase() !== (city ?? "").toLowerCase()
        ? p.neighborhood
        : null;

    if (isGoogleGeocodingEnabled()) {
        const g = await geocodeGoogle(address, p, city, state, opts);
        if (g) return g;
    }

    if (p.street) {
        const rua = normalizeStreet(p.street);
        const comNumero = p.number ? `${p.number} ${rua}` : rua;

        const tentativas: Array<Record<string, string>> = [];
        if (p.cep) tentativas.push({ street: comNumero, city: city ?? "", state: state ?? "", postalcode: p.cep });
        tentativas.push({ street: comNumero, city: city ?? "", state: state ?? "" });
        if (p.number) tentativas.push({ street: rua, city: city ?? "", state: state ?? "" });

        for (const t of tentativas) {
            const r = await nominatimEstruturado(t, opts);
            if (r) return r;
        }

        // O nome da rua pode estar escrito errado — o CEP corrige.
        if (p.cep) {
            const viacep = await consultarViaCep(p.cep);
            if (viacep?.logradouro && viacep.logradouro !== p.street) {
                const ruaCorrigida = p.number
                    ? `${p.number} ${normalizeStreet(viacep.logradouro)}`
                    : normalizeStreet(viacep.logradouro);
                const r = await nominatimEstruturado(
                    { street: ruaCorrigida, city: viacep.localidade || city || "", state: viacep.uf || state || "" },
                    opts
                );
                if (r) return { ...r, provider: "viacep+osm" };
            }
        }
    }

    // Sem a rua, um ponto no bairro ainda orienta melhor que o centro da cidade.
    if (bairro && city) {
        const r = await nominatimLivre(`${bairro}, ${city}, ${state ?? ""}, Brasil`, opts);
        if (r) return { ...r, precision: "bairro" };
    }

    if (city) {
        const r = await nominatimLivre(`${city}, ${state ?? ""}, Brasil`, opts);
        if (r) return { ...r, precision: "cidade" };
    }

    return null;
}

// ------------------------------------------------------------------- Google

async function geocodeGoogle(
    original: string,
    p: ReturnType<typeof parseBrazilianAddress>,
    city: string | null,
    state: string | null,
    opts?: GeocodeOpts
): Promise<GeocodeResult | null> {
    // Sem o complemento entre parênteses; com cidade/UF garantidas no fim.
    const partes = [p.clean || original];
    if (city && !new RegExp(city, "i").test(partes[0])) partes.push(city);
    if (state) partes.push(state);
    partes.push("Brasil");

    const params = new URLSearchParams({
        address: partes.join(", "),
        key: process.env.GOOGLE_MAPS_API_KEY!,
        region: "br",
        language: "pt-BR",
        components: `country:BR${p.cep ? `|postal_code:${p.cep}` : ""}`,
    });

    if (opts?.shopLat != null && opts?.shopLng != null) {
        const d = (opts.radiusKm ?? 60) / 111;
        params.set("bounds", `${opts.shopLat - d},${opts.shopLng - d}|${opts.shopLat + d},${opts.shopLng + d}`);
    }

    try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
        const data = await res.json();

        if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
            console.error("[GEOCODE] Google recusou:", data.status, data.error_message);
            return null; // cai pro caminho gratuito
        }
        if (data.status !== "OK" || !data.results?.length) return null;

        const melhor = data.results[0];
        const tipo: string = melhor.geometry?.location_type ?? "";
        const precision: GeocodePrecision =
            tipo === "ROOFTOP" ? "exata"
                : tipo === "RANGE_INTERPOLATED" ? "exata"
                    : melhor.types?.includes("route") ? "rua"
                        : melhor.types?.some((t: string) => t.includes("sublocality") || t === "neighborhood") ? "bairro"
                            : "cidade";

        return {
            lat: melhor.geometry.location.lat,
            lng: melhor.geometry.location.lng,
            precision,
            provider: "google",
            formatted: melhor.formatted_address,
        };
    } catch (e) {
        console.error("[GEOCODE] Google falhou:", e);
        return null;
    }
}

// --------------------------------------------------------------- OpenStreetMap

async function nominatimEstruturado(
    campos: Record<string, string>,
    opts?: GeocodeOpts
): Promise<GeocodeResult | null> {
    const params = new URLSearchParams({
        format: "json",
        limit: "1",
        countrycodes: "br",
        addressdetails: "1",
        "accept-language": "pt-BR",
    });
    for (const [k, v] of Object.entries(campos)) if (v) params.set(k, v);
    aplicarViewbox(params, opts);
    return chamarNominatim(params);
}

async function nominatimLivre(q: string, opts?: GeocodeOpts): Promise<GeocodeResult | null> {
    const params = new URLSearchParams({
        format: "json", q, limit: "1", countrycodes: "br",
        addressdetails: "1", "accept-language": "pt-BR",
    });
    aplicarViewbox(params, opts);
    return chamarNominatim(params);
}

function aplicarViewbox(params: URLSearchParams, opts?: GeocodeOpts): void {
    if (opts?.shopLat == null || opts?.shopLng == null) return;
    const d = (opts.radiusKm ?? 60) / 111;
    params.set("viewbox", `${opts.shopLng - d},${opts.shopLat + d},${opts.shopLng + d},${opts.shopLat - d}`);
}

async function chamarNominatim(params: URLSearchParams): Promise<GeocodeResult | null> {
    try {
        await respeitarLimiteOsm();
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
            headers: { "User-Agent": NOMINATIM_UA },
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.[0]) return null;

        const hit = data[0];
        const addr = hit.address ?? {};
        const precision: GeocodePrecision = addr.house_number
            ? "exata"
            : (addr.road ? "rua" : "bairro");

        return {
            lat: parseFloat(hit.lat),
            lng: parseFloat(hit.lon),
            precision,
            provider: "osm",
            formatted: hit.display_name,
        };
    } catch (e) {
        console.error("[GEOCODE] OpenStreetMap falhou:", e);
        return null;
    }
}

// ---------------------------------------------------------------------- CEP

interface ViaCepResposta {
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
    erro?: boolean | string;
}

/** ViaCEP é gratuito e não pede cadastro; serve pra corrigir o nome da rua. */
export async function consultarViaCep(cep: string): Promise<ViaCepResposta | null> {
    const so8 = cep.replace(/\D/g, "");
    if (so8.length !== 8) return null;
    try {
        const res = await fetch(`https://viacep.com.br/ws/${so8}/json/`);
        if (!res.ok) return null;
        const data = await res.json() as ViaCepResposta;
        if (data.erro) return null;
        return data;
    } catch {
        return null;
    }
}
