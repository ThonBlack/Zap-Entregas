import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * Trava contra o duplo clique: já existe uma corrida igual, dessa loja, criada
 * há pouco?
 *
 * Mora aqui, e não solta dentro das actions, porque a comparação de data tem
 * uma pegadinha: o banco guarda `created_at` em dois formatos
 * ("2026-08-21 16:08:38" do CURRENT_TIMESTAMP antigo e "2026-08-21T16:08:38.000Z"
 * do código). No SQLite a comparação é de texto e o espaço vem antes do "T",
 * então comparar direto dava sempre falso — a trava simplesmente não pegava e
 * dois cliques viravam duas corridas (e duas taxas). `datetime()` normaliza os
 * dois formatos antes de comparar.
 */
export async function existeCorridaIgualRecente(
    shopkeeperId: number,
    address: string,
    minutos: number,
): Promise<boolean> {
    const janela = `-${Math.max(1, Math.round(minutos * 60))} seconds`;
    const achada = await db.query.deliveries.findFirst({
        where: and(
            eq(deliveries.shopkeeperId, shopkeeperId),
            eq(deliveries.address, address),
            sql`datetime(${deliveries.createdAt}) >= datetime('now', ${janela})`,
        ),
        columns: { id: true },
    });
    return !!achada;
}
