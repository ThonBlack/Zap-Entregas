import "server-only";

import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/session";

/**
 * Quem pode usar a busca de endereço (o nosso atalho pro Google Places).
 *
 * As duas rotas `/api/places/*` gastam a chave PAGA do servidor — a mesma que o
 * geocode das corridas usa. Estavam abertas: qualquer um na internet podia ficar
 * chamando num laço e queimar a cota/fatura do Google. Quando a cota estoura, as
 * corridas de verdade param de achar endereço.
 *
 * Duas credenciais valem:
 *  - estar logado no app (lojista, motoboy ou admin — quem preenche endereço);
 *  - o código de conferência do PDV: o caixa que abre `/confirmar/<código>` não
 *    tem conta no Zap, mas o código dele autoriza mexer naquela corrida, então
 *    autoriza também buscar o endereço dela.
 */
export type QuemChamou =
    | { autorizado: true; chave: string }
    | { autorizado: false };

export async function autorizarBuscaDeEndereco(confirmToken: string | null): Promise<QuemChamou> {
    const userId = await getSessionUserId();
    if (userId) return { autorizado: true, chave: `sessao:${userId}` };

    if (confirmToken && confirmToken.length >= 16) {
        const corrida = await db.query.deliveries.findFirst({
            where: eq(deliveries.confirmToken, confirmToken),
            columns: { id: true, status: true, confirmTokenExpiresAt: true },
        });
        const vencido = Boolean(
            corrida?.confirmTokenExpiresAt && new Date(corrida.confirmTokenExpiresAt) < new Date()
        );
        if (corrida && corrida.status === "draft" && !vencido) {
            return { autorizado: true, chave: `pdv:${corrida.id}` };
        }
    }

    return { autorizado: false };
}
