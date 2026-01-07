"use server";

import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { geocodeAddress, optimizeRoute } from "@/lib/routeUtils";

export async function createRouteAction(prevState: any, formData: FormData) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    // Parse form data
    const addresses = formData.getAll("address");
    const names = formData.getAll("name");
    const values = formData.getAll("value");
    const phones = formData.getAll("customerPhone");
    const observations = formData.getAll("observation");

    if (!addresses.length) return { error: "Adicione ao menos um endereço" };

    // 1. Geocode all addresses
    const points = await Promise.all(addresses.map(async (addr, index) => {
        const coords = await geocodeAddress(addr as string);
        return {
            index,
            address: addr as string,
            lat: coords?.lat || 0,
            lng: coords?.lng || 0
        };
    }));

    // 2. Optimization (Nearest Neighbor)
    // Start point: Generic center or first address if Lat/Lng not 0
    //Ideally we would have the shop address saved in user profile.
    //For now, let's assume Shop starts at the first valid point found or just optimize based on the first address entered being the first stop?
    // Actually, usually the route starts FROM the shop.
    // Let's assume start point is the first address for simplicity or add a Shop Address later.
    // Logic change: Reorder points starting from "virtual" shop location (0,0) or just optimize the list relative to each other.

    // Better approach for MVP:
    // Optimize starting from the first address in the list as "Start", then find next closest.
    // OR simpler: just save them. But user wants optimization.

    // Let's try to optimize assuming the Motoboy starts at the first Delivery location? No.
    // Let's assume Shop is at coordinates of the first geocoded result for now, acting as the depot.
    // Or better: Treat the list as a set of points to visit.

    const validPoints = points.filter(p => p.lat !== 0);
    const optimizedPath = validPoints.length > 0
        ? optimizeRoute(validPoints[0], validPoints)
        : points; // Fallback if geocoding fails

    // Map back to deliveries with new order
    const newDeliveries = optimizedPath.map((p, i) => {
        const originalIndex = p.index;
        return {
            shopkeeperId: Number(userId),
            address: addresses[originalIndex] as string,
            customerName: names[originalIndex] as string,
            customerPhone: phones[originalIndex] as string,
            observation: observations[originalIndex] as string,
            value: Number(values[originalIndex]) || 0,
            status: "pending" as const,
            stopOrder: i + 1, // 1st stop, 2nd stop...
            lat: p.lat,
            lng: p.lng
        };
    });

    // If some addresses failed geocoding, append them at the end
    const failedPoints = points.filter(p => p.lat === 0);
    failedPoints.forEach((p, i) => {
        newDeliveries.push({
            shopkeeperId: Number(userId),
            address: addresses[p.index] as string,
            customerName: names[p.index] as string,
            customerPhone: phones[p.index] as string,
            observation: observations[p.index] as string,
            value: Number(values[p.index]) || 0,
            status: "pending" as const,
            stopOrder: optimizedPath.length + i + 1,
            lat: 0,
            lng: 0
        });
    });

    // Insert all
    await db.insert(deliveries).values(newDeliveries);

    redirect("/");
}
