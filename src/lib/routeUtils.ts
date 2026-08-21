// Utilidades de rota e distância.
// A busca de endereço vive em @/lib/geocode (cascata Google → OpenStreetMap → CEP)
// e é reexportada aqui porque o app inteiro já importava deste arquivo.

import { getDistance } from "geolib";

export { geocodeAddress, isGoogleGeocodingEnabled, consultarViaCep } from "@/lib/geocode";
export type { GeocodeOpts, GeocodeResult, GeocodePrecision } from "@/lib/geocode";

export interface RoutePoint {
    lat: number;
    lng: number;
    address?: string;
    [key: string]: any;
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
