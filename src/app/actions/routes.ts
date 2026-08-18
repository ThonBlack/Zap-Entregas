"use server";

import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";

import { geocodeAddress, optimizeRoute } from "@/lib/routeUtils";
import { getAuthUserWithRole } from "@/lib/session";
import { newTrackingToken } from "@/lib/trackingToken";

export async function createRouteAction(prevState: any, formData: FormData) {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return auth;
    const me = auth.user;

    const addresses = formData.getAll("address");
    const names = formData.getAll("name");
    const values = formData.getAll("value");
    const phones = formData.getAll("customerPhone");
    const observations = formData.getAll("observation");

    if (!addresses.length) return { error: "Adicione ao menos um endereço" };

    const recentDelivery = await db.query.deliveries.findFirst({
        where: and(
            eq(deliveries.shopkeeperId, me.id),
            eq(deliveries.address, addresses[0] as string),
            gt(deliveries.createdAt, new Date(Date.now() - 60000).toISOString())
        ),
    });

    if (recentDelivery) {
        return { error: "Rota já criada recentemente. Aguarde um momento." };
    }

    const shopCfg = await db.query.shopSettings.findFirst({
        where: eq(shopSettings.userId, me.id),
        columns: { defaultCity: true, defaultState: true, shopLat: true, shopLng: true },
    });
    const geoOpts = {
        defaultCity: shopCfg?.defaultCity ?? null,
        defaultState: shopCfg?.defaultState ?? null,
        shopLat: shopCfg?.shopLat ?? null,
        shopLng: shopCfg?.shopLng ?? null,
    };

    const points = await Promise.all(addresses.map(async (addr, index) => {
        const coords = await geocodeAddress(addr as string, geoOpts);
        return {
            index,
            address: addr as string,
            lat: coords?.lat || 0,
            lng: coords?.lng || 0,
        };
    }));

    const validPoints = points.filter(p => p.lat !== 0);
    const optimizedPath = validPoints.length > 0
        ? optimizeRoute(validPoints[0], validPoints)
        : points;

    const newDeliveries = optimizedPath.map((p, i) => {
        const originalIndex = p.index;
        return {
            shopkeeperId: me.id,
            address: addresses[originalIndex] as string,
            customerName: names[originalIndex] as string,
            customerPhone: phones[originalIndex] as string,
            observation: observations[originalIndex] as string,
            value: Number(values[originalIndex]) || 0,
            status: "pending" as const,
            stopOrder: i + 1,
            lat: p.lat,
            lng: p.lng,
            publicToken: newTrackingToken(),
        };
    });

    const failedPoints = points.filter(p => p.lat === 0);
    failedPoints.forEach((p, i) => {
        newDeliveries.push({
            shopkeeperId: me.id,
            address: addresses[p.index] as string,
            customerName: names[p.index] as string,
            customerPhone: phones[p.index] as string,
            observation: observations[p.index] as string,
            value: Number(values[p.index]) || 0,
            status: "pending" as const,
            stopOrder: optimizedPath.length + i + 1,
            lat: 0,
            lng: 0,
            publicToken: newTrackingToken(),
        });
    });

    await db.insert(deliveries).values(newDeliveries);

    redirect("/app");
}
