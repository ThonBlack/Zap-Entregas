// Wrapper Nominatim com fallback de cidade e bias regional.
// Em produção: rate limit 1 req/seg do Nominatim público — considerar Google Maps Platform
// se volume crescer.

import { getDistance } from "geolib";

interface Point {
    lat: number;
    lng: number;
    address?: string;
}

export interface RoutePoint {
    lat: number;
    lng: number;
    address?: string;
    [key: string]: any;
}

export interface GeocodeOpts {
    /** Cidade de fallback (ex: "Uberaba") — anexada ao final se o endereço não tiver UF/cidade */
    defaultCity?: string | null;
    /** UF de fallback (ex: "MG") */
    defaultState?: string | null;
    /** Coord central da loja — usado pra viewbox e fallback final */
    shopLat?: number | null;
    shopLng?: number | null;
    /** Raio em km do viewbox (padrão 60) */
    radiusKm?: number;
}

const STATE_REGEX = /[\/\-,\s][A-Z]{2}(\b|$)/;

function hasStateOrCity(address: string, city?: string | null): boolean {
    if (STATE_REGEX.test(address)) return true;
    if (city && address.toLowerCase().includes(city.toLowerCase())) return true;
    return false;
}

function buildQuery(address: string, opts?: GeocodeOpts): string {
    const trimmed = address.trim();
    if (!opts?.defaultCity) return trimmed;
    if (hasStateOrCity(trimmed, opts.defaultCity)) return trimmed;
    return opts.defaultState
        ? `${trimmed} - ${opts.defaultCity}/${opts.defaultState}`
        : `${trimmed} - ${opts.defaultCity}`;
}

function viewboxFromCenter(lat: number, lng: number, radiusKm: number): string {
    // Aproximação simples: 1 grau lat ≈ 111km
    const deg = radiusKm / 111;
    const west = lng - deg;
    const east = lng + deg;
    const north = lat + deg;
    const south = lat - deg;
    return `${west},${north},${east},${south}`;
}

export async function geocodeAddress(
    address: string,
    opts?: GeocodeOpts
): Promise<{ lat: number; lng: number } | null> {
    const q = buildQuery(address, opts);

    const params = new URLSearchParams({
        format: "json",
        q,
        limit: "1",
        countrycodes: "br",
        "accept-language": "pt-BR",
        addressdetails: "0",
    });

    if (opts?.shopLat != null && opts?.shopLng != null) {
        const viewbox = viewboxFromCenter(opts.shopLat, opts.shopLng, opts.radiusKm ?? 60);
        params.set("viewbox", viewbox);
        params.set("bounded", "1");
    }

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
            headers: {
                "User-Agent": "ZapEntregas/1.0 (contato@zapentregas.duckdns.org)",
            },
        });
        const data = await response.json();
        if (data && data[0]) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
            };
        }

        // Fallback: se viewbox foi muito restritivo, tenta sem bounded
        if (params.get("bounded") === "1") {
            params.delete("bounded");
            const retry = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
                headers: { "User-Agent": "ZapEntregas/1.0 (contato@zapentregas.duckdns.org)" },
            });
            const retryData = await retry.json();
            if (retryData && retryData[0]) {
                return {
                    lat: parseFloat(retryData[0].lat),
                    lng: parseFloat(retryData[0].lon),
                };
            }
        }
    } catch (e) {
        console.error("Geocoding error:", e);
    }
    return null;
}

/** Distância em km entre dois pontos */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const meters = getDistance(
        { latitude: lat1, longitude: lng1 },
        { latitude: lat2, longitude: lng2 }
    );
    return meters / 1000;
}

/** Marca endereço como suspeito se cair fora do raio da loja */
export function isAddressSuspicious(
    lat: number,
    lng: number,
    shopLat?: number | null,
    shopLng?: number | null,
    maxKm: number = 100
): boolean {
    if (shopLat == null || shopLng == null) return false;
    if (lat === 0 || lng === 0) return false;
    return distanceKm(lat, lng, shopLat, shopLng) > maxKm;
}

// Nearest Neighbor
export function optimizeRoute<T extends RoutePoint>(start: T, points: T[]): T[] {
    let current = start;
    const path = [current];
    const unvisited = new Set(points.filter(p => p !== start));

    while (unvisited.size > 0) {
        let nearest: T | null = null;
        let minDist = Infinity;

        for (const point of unvisited) {
            const dist = getDistance(
                { latitude: current.lat, longitude: current.lng },
                { latitude: point.lat, longitude: point.lng }
            );

            if (dist < minDist) {
                minDist = dist;
                nearest = point;
            }
        }

        if (nearest) {
            path.push(nearest);
            unvisited.delete(nearest);
            current = nearest;
        } else {
            break;
        }
    }

    return path;
}
