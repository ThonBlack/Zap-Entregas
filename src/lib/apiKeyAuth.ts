import "server-only";

import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Quem é a loja dona desta chave de API (header `X-API-KEY: zap_<id>_<acaso>`).
 *
 * Mora aqui, num lugar só, porque duas portas de entrada do EpicStore usam a
 * MESMA credencial: o webhook que cria a corrida a partir da venda
 * (/api/integration/delivery) e o pedido de sessão da fila da loja
 * (/api/integration/queue-session). Se cada uma checasse por conta própria, uma
 * delas envelheceria — e a que envelhecesse seria a porta destrancada.
 *
 * O prefixo "zap_" é conferido antes de ir ao banco: chave de outro formato nem
 * vira consulta.
 *
 * ⚠️ NÃO confere `is_active` de propósito. O webhook de venda nunca conferiu, e
 * passar a recusar aqui faria a loja desativada parar de registrar corrida sem
 * ninguém ter pedido isso. Quem quiser essa recusa aplica na própria rota — é o
 * que a rota da fila faz, porque lá é funcionalidade nova e não quebra nada.
 */
export async function autenticarChaveDeApi(apiKey: string | null) {
    if (!apiKey || !apiKey.startsWith("zap_")) return null;
    const loja = await db.query.users.findFirst({
        where: and(eq(users.apiKey, apiKey), eq(users.role, "shopkeeper")),
    });
    return loja ?? null;
}
