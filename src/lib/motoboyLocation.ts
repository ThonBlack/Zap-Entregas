import "server-only";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Onde o motoboy está agora.
 *
 * Mora numa lib, e não no arquivo de server actions, porque tudo que é exportado
 * de um `"use server"` vira um endereço que QUALQUER navegador pode chamar. A
 * versão action disso não tinha checagem nenhuma: bastava passar 1, 2, 3… pra
 * ler a localização ao vivo de todo motoboy cadastrado, sem nem estar logado.
 *
 * A página pública de rastreio precisa mesmo da posição — mas só do motoboy
 * daquele pedido, e ela já provou que conhece o pedido pelo token secreto do
 * link. Por isso ela chama esta função aqui (do servidor, sem expor rota), e a
 * action equivalente passou a exigir sessão.
 *
 * Nada aqui devolve dado da LOJA: o cliente não tem que saber de onde saiu.
 */
export type LocalDoMotoboy = {
    lat: number | null;
    lng: number | null;
    lastUpdate: string | null;
    name: string;
};

export async function carregarLocalDoMotoboy(motoboyId: number): Promise<LocalDoMotoboy | null> {
    if (!Number.isInteger(motoboyId) || motoboyId <= 0) return null;

    const achado = await db
        .select({
            lat: users.currentLat,
            lng: users.currentLng,
            lastUpdate: users.lastLocationUpdate,
            name: users.name,
        })
        .from(users)
        .where(eq(users.id, motoboyId))
        .get();

    return achado ?? null;
}
