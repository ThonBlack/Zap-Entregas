import "server-only";

import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/session";
import { carregarSessaoValida } from "@/lib/queueSession";

/**
 * Quem pode usar a busca de endereço (o nosso atalho pro Google Places).
 *
 * As duas rotas `/api/places/*` gastam a chave PAGA do servidor — a mesma que o
 * geocode das corridas usa. Estavam abertas: qualquer um na internet podia ficar
 * chamando num laço e queimar a cota/fatura do Google. Quando a cota estoura, as
 * corridas de verdade param de achar endereço.
 *
 * Três credenciais valem:
 *  - estar logado no app (lojista, motoboy ou admin — quem preenche endereço);
 *  - o código de conferência do PDV: o caixa que abre `/confirmar/<código>` não
 *    tem conta no Zap, mas o código dele autoriza mexer naquela corrida, então
 *    autoriza também buscar o endereço dela;
 *  - o código da Fila da loja: o vendedor em `/fila/<código>` também não tem
 *    conta, e o formulário de lançar corrida dele vive de buscar endereço.
 *    Dentro do quadro do EpicStore não existe cookie nosso, então sem isto o
 *    campo de endereço simplesmente não sugeriria nada.
 */
export type QuemChamou =
    | { autorizado: true; chave: string }
    | { autorizado: false };

export async function autorizarBuscaDeEndereco(
    confirmToken: string | null,
    filaToken?: string | null,
): Promise<QuemChamou> {
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

    if (filaToken) {
        const sessao = await carregarSessaoValida(filaToken);
        // A conta do ritmo é por LOJA, não por sessão: a loja com três PCs no
        // balcão divide a mesma cota do Google, que é o que a gente paga.
        if (sessao) return { autorizado: true, chave: `fila:${sessao.shopkeeperId}` };
    }

    return { autorizado: false };
}
