// Basic wrapper for OpenStreetMap Nominatim
// Note: In production, consider rate limiting or a paid service like Google Maps Platform.

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

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
            headers: {
                'User-Agent': 'ZapEntregas/1.0'
            }
        });
        const data = await response.json();
        if (data && data[0]) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
    } catch (e) {
        console.error("Geocoding error:", e);
    }
    return null;
}

// Simple Nearest Neighbor Algorithm using geolib
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


