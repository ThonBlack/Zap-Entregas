"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthUserWithRole } from "@/lib/session";
import { carregarMotoboyGerenciado } from "@/lib/team";
import { carregarLocalDoMotoboy } from "@/lib/motoboyLocation";

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

/**
 * Onde um motoboy está agora — pra quem está LOGADO e tem a ver com ele.
 *
 * Isto aqui é exportado de um arquivo `"use server"`, então é um endereço que
 * qualquer navegador pode chamar. Antes não tinha checagem nenhuma: bastava
 * passar 1, 2, 3… pra ler a localização ao vivo de todo motoboy do app, sem nem
 * estar logado. Agora:
 *   - motoboy  → só a própria posição;
 *   - lojista  → só os motoboys da equipe dele (motoboyScope);
 *   - admin    → todos.
 *
 * A página pública de rastreio NÃO passa por aqui: ela chama
 * `carregarLocalDoMotoboy` direto do servidor (src/lib/motoboyLocation.ts),
 * porque o token secreto do link já é a autorização dela — e ela mostra só a
 * posição do motoboy daquele pedido, nunca a da loja.
 */
export async function getMotoboyLocationAction(motoboyId: number) {
    const auth = await getAuthUserWithRole(["motoboy", "shopkeeper", "admin"]);
    if ("error" in auth) return null;
    const me = auth.user;

    const id = Number(motoboyId);
    if (!Number.isInteger(id) || id <= 0) return null;

    if (me.role === "motoboy") {
        if (id !== me.id) return null;
    } else if (me.role !== "admin") {
        // Lojista: só quem é da equipe dele. `null` de propósito quando não é —
        // igual a "não existe", pra não confirmar que o id existe em outra loja.
        if (!(await carregarMotoboyGerenciado(me, id))) return null;
    }

    return carregarLocalDoMotoboy(id);
}
