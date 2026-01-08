"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function updateLocationAction(lat: number, lng: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) return { error: "Não autenticado" };

    try {
        await db.update(users)
            .set({
                currentLat: lat,
                currentLng: lng,
                lastLocationUpdate: new Date().toISOString()
            })
            .where(eq(users.id, Number(userId)));

        return { success: true };
    } catch (e) {
        console.error("Erro ao atualizar localização:", e);
        return { error: "Erro ao salvar localização" };
    }
}

export async function getMotoboyLocationAction(motoboyId: number) {
    const user = await db.select({
        lat: users.currentLat,
        lng: users.currentLng,
        lastUpdate: users.lastLocationUpdate,
        name: users.name
    })
        .from(users)
        .where(eq(users.id, motoboyId))
        .get();

    return user;
}
