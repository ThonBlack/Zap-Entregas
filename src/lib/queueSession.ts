import "server-only";

import { db } from "@/db";
import { shopQueueSessions } from "@/db/schema";
import { eq, lt } from "drizzle-orm";
import { newQueueToken, queueSessionExpiry } from "@/lib/trackingToken";

/**
 * A sessão da "Fila da loja" — quem abriu a tela embutida no painel do
 * EpicStore e até quando ela vale.
 *
 * O vendedor não tem conta no Zap Entregas. Tudo que ele pode fazer na fila é
 * decidido por UMA coisa: o `shopkeeper_id` guardado nesta linha. Nenhuma tela
 * e nenhuma ação da fila aceita "de que loja é" vindo do navegador — sai daqui
 * sempre, senão bastaria trocar um número na URL pra ver a corrida do vizinho.
 */

export type SessaoDaFila = {
    id: number;
    token: string;
    shopkeeperId: number;
    operatorName: string | null;
    expiresAt: string;
};

/** Tamanho máximo do nome de quem está no caixa (contrato com o EpicStore). */
export const LIMITE_NOME_OPERADOR = 80;

/**
 * Nome do operador que veio de fora, aparado e limitado. Vazio, só espaço ou de
 * outro tipo vira `null` — o nome é enfeite útil, nunca obrigatório.
 */
export function limparNomeDoOperador(bruto: unknown): string | null {
    if (typeof bruto !== "string") return null;
    const nome = bruto.trim().slice(0, LIMITE_NOME_OPERADOR);
    return nome || null;
}

/**
 * Cria a sessão e já leva o lixo: as vencidas somem antes.
 *
 * A faxina fica aqui, e não num cron, porque a tabela só cresce quando alguém
 * pede sessão — então o momento de pedir é exatamente o momento de limpar.
 * Sessão VÁLIDA de outro PC nunca é apagada: a loja tem mais de um caixa e cada
 * um tem a sua.
 */
export async function criarSessaoDaFila(
    shopkeeperId: number,
    operatorName: string | null,
): Promise<{ token: string; expiresAt: string }> {
    const agora = new Date();
    await db.delete(shopQueueSessions).where(lt(shopQueueSessions.expiresAt, agora.toISOString()));

    const token = newQueueToken();
    const expiresAt = queueSessionExpiry(agora);

    await db.insert(shopQueueSessions).values({
        token,
        shopkeeperId,
        operatorName,
        expiresAt,
        // ISO explícito: o CURRENT_TIMESTAMP do banco grava noutro formato e as
        // duas formas juntas quebram comparação de data.
        createdAt: agora.toISOString(),
    });

    return { token, expiresAt };
}

/**
 * A sessão deste código, SE ela existir e ainda estiver no prazo.
 *
 * `null` nos dois casos de propósito: pra quem chama, "código que nunca existiu"
 * e "código que venceu" dão no mesmo — a tela avisa o EpicStore e ele pede
 * outra. Diferenciar só ajudaria quem está tentando adivinhar código.
 */
export async function carregarSessaoValida(
    token: string | null | undefined,
): Promise<SessaoDaFila | null> {
    // Código curto demais nem vira consulta: o nosso tem 32 caracteres.
    if (typeof token !== "string" || token.length < 16) return null;

    const sessao = await db.query.shopQueueSessions.findFirst({
        where: eq(shopQueueSessions.token, token),
    });
    if (!sessao) return null;
    if (new Date(sessao.expiresAt) < new Date()) return null;

    return {
        id: sessao.id,
        token: sessao.token,
        shopkeeperId: sessao.shopkeeperId,
        operatorName: sessao.operatorName,
        expiresAt: sessao.expiresAt,
    };
}
