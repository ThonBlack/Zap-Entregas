"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthUserWithRole } from "@/lib/session";

export async function updateLocationAction(lat: number, lng: number) {
    const auth = await getAuthUserWithRole(["motoboy", "admin"]);
    if ("error" in auth) return auth;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { error: "Coordenadas inválidas" };
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { error: "Coordenadas fora do intervalo" };
    }

    try {
        await db.update(users)
            .set({
                currentLat: lat,
                currentLng: lng,
                lastLocationUpdate: new Date().toISOString(),
            })
            .where(eq(users.id, auth.user.id));

        return { success: true };
    } catch (e) {
        console.error("Erro ao atualizar localização:", e);
        return { error: "Erro ao salvar localização" };
    }
}

export async function getMotoboyLocationAction(motoboyId: number) {
    if (!Number.isInteger(motoboyId) || motoboyId <= 0) return null;

    const user = await db.select({
        lat: users.currentLat,
        lng: users.currentLng,
        lastUpdate: users.lastLocationUpdate,
        name: users.name,
    })
        .from(users)
        .where(eq(users.id, motoboyId))
        .get();

    return user;
}
