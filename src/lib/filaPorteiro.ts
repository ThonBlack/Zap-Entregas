import "server-only";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { carregarSessaoValida, type SessaoDaFila } from "@/lib/queueSession";
import { aplicarLimite } from "@/lib/rateLimit";

/**
 * O porteiro das ações da "Fila da loja" (src/app/actions/queue.ts e
 * src/app/actions/filaMotoboy.ts).
 *
 * Saiu do arquivo das ações porque agora são dois arquivos de ação e os dois
 * têm que passar pela MESMA porta — duas cópias de "o código vale?" divergem.
 * E num arquivo "use server" toda função exportada vira ação chamável de fora;
 * aqui não.
 */

export type Autorizado =
    | { ok: true; sessao: SessaoDaFila }
    | { ok: false; erro: string };

/**
 * Código válido e dentro do ritmo.
 *
 * O limite é por CÓDIGO (não por IP): é ele que autoriza, então é ele que tem
 * que cansar se alguém sair chamando em laço.
 */
export async function autorizarFila(token: unknown): Promise<Autorizado> {
    const codigo = typeof token === "string" ? token : "";
    const sessao = await carregarSessaoValida(codigo);
    if (!sessao) {
        return { ok: false, erro: "A fila da loja expirou. Feche e abra de novo pelo painel." };
    }

    const ritmo = aplicarLimite("fila", `token:${sessao.token}`);
    if (!ritmo.permitido) {
        return { ok: false, erro: `Muitos cliques seguidos. Espere ${ritmo.esperarSegundos} segundos.` };
    }

    return { ok: true, sessao };
}

/** A corrida, só se ela for DESTA loja. Fora do escopo = não existe. */
export async function corridaDaLoja(sessao: SessaoDaFila, idBruto: unknown) {
    const id = Number(idBruto);
    if (!Number.isInteger(id) || id <= 0) return null;

    const corrida = await db.query.deliveries.findFirst({
        where: and(
            eq(deliveries.id, id),
            eq(deliveries.shopkeeperId, sessao.shopkeeperId),
        ),
    });
    return corrida ?? null;
}
