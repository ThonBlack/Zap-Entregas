import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { diaBrasiliaDe } from "@/lib/datetime";

/**
 * O contador diário das corridas — "Corrida 1, 2, 3…" por LOJA, recomeçando do
 * 1 a cada dia de Brasília.
 *
 * Por que mora aqui, num lugar só: a corrida nasce em quatro portas diferentes
 * (cadastro na tela, rota com várias paradas, webhook do PDV e a liberação do
 * rascunho). Se cada uma calculasse o próximo número por conta própria, duas
 * delas divergiriam com o tempo — e o número é justamente o que a loja usa pra
 * falar da corrida no grupo de WhatsApp.
 *
 * ⚠️ Chame SEMPRE dentro da MESMA transação do INSERT (`db.transaction`, que no
 * better-sqlite3 é síncrona). Ler o maior número e gravar depois, com um
 * `await` no meio, é a receita de dois pedidos que chegam juntos virarem dois
 * "Corrida 7" — foi por isso que o fechamento da corrida (deliveryLedger.ts)
 * também virou transação.
 *
 * O dia sai do `created_at`, que o banco guarda em UTC e em dois formatos
 * ("…T17:46:09.111Z" do código novo e "… 17:46:09" do CURRENT_TIMESTAMP
 * antigo). Quem normaliza os dois é o próprio SQLite, com
 * `date(datetime(created_at, '-3 hours'))` — a mesma régua do Resumo do dia.
 * UTC−3 fixo: o Brasil não tem mais horário de verão.
 */

/** A "mão" da transação do Drizzle (o mesmo tipo que deliveryLedger.ts usa). */
export type Transacao = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Qual é o próximo "Corrida N" desta loja no dia de Brasília de `agoraISO`.
 *
 * Devolve `null` quando não dá pra numerar — corrida sem loja (admin criando
 * solto) ou data ilegível. `null` é aceito de bom grado: a coluna é opcional e
 * a tela simplesmente não mostra o rótulo.
 */
export function proximoNumeroDoDia(
    tx: Transacao,
    shopkeeperId: number | null | undefined,
    agoraISO: string,
): number | null {
    if (shopkeeperId == null) return null;

    const dia = diaBrasiliaDe(agoraISO);
    if (!dia) return null;

    const linha = tx
        .select({ topo: sql<number>`COALESCE(MAX(${deliveries.dailySeq}), 0)` })
        .from(deliveries)
        .where(
            and(
                eq(deliveries.shopkeeperId, shopkeeperId),
                sql`date(datetime(${deliveries.createdAt}, '-3 hours')) = ${dia}`,
            ),
        )
        .get();

    return Number(linha?.topo ?? 0) + 1;
}

/**
 * Os próximos `quantas` números seguidos — a rota com várias paradas vira
 * "Corrida 7, 8, 9", na ordem em que as paradas entram no banco.
 *
 * Mesma exigência do irmão acima: dentro da transação do INSERT.
 */
export function sequenciaDoDia(
    tx: Transacao,
    shopkeeperId: number | null | undefined,
    agoraISO: string,
    quantas: number,
): (number | null)[] {
    const primeiro = proximoNumeroDoDia(tx, shopkeeperId, agoraISO);
    return Array.from({ length: Math.max(0, quantas) }, (_, i) =>
        primeiro == null ? null : primeiro + i,
    );
}
