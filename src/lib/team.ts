import "server-only";
import { and, eq, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Quem é a equipe de quem.
 *
 * Antes desta camada, "motoboy" era global: qualquer lojista via, editava e
 * lançava dinheiro na carteira do motoboy de qualquer outra loja. Agora o
 * motoboy pertence a quem o cadastrou (users.shopkeeper_id) e todo lugar que
 * lista ou toca em motoboy passa por aqui.
 *
 * Regras:
 *   - lojista → só os motoboys com shopkeeper_id = ele
 *   - admin   → todos, inclusive os "da casa" (shopkeeper_id NULL)
 */

export type Ator = {
    id: number;
    role: "admin" | "shopkeeper" | "motoboy";
};

export function ehAdmin(me: Ator): boolean {
    return me.role === "admin";
}

/** is_active pode ser NULL em cadastro antigo — NULL conta como ativo. */
const ATIVO = or(eq(users.isActive, true), isNull(users.isActive));

/** Condição SQL "motoboys que ESTA pessoa gerencia". */
export function motoboyScope(
    me: Ator,
    opcoes: { incluirDesativados?: boolean } = {}
): SQL | undefined {
    const partes: (SQL | undefined)[] = [eq(users.role, "motoboy")];
    if (!ehAdmin(me)) partes.push(eq(users.shopkeeperId, me.id));
    if (!opcoes.incluirDesativados) partes.push(ATIVO);
    return and(...partes);
}

/**
 * Carrega o motoboy SE esta pessoa puder mexer nele. Devolve null quando não é
 * da loja dela — de propósito igual a "não existe", pra não confirmar que o id
 * existe em outra loja.
 */
export async function carregarMotoboyGerenciado(me: Ator, motoboyId: number) {
    if (!Number.isInteger(motoboyId) || motoboyId <= 0) return null;
    if (me.role === "motoboy") return null;

    const motoboy = await db.query.users.findFirst({
        where: and(eq(users.id, motoboyId), motoboyScope(me, { incluirDesativados: true })),
    });

    return motoboy ?? null;
}

/** Ids dos motoboys da equipe — pra filtrar extrato, lançamentos etc. */
export async function idsDaEquipe(
    me: Ator,
    opcoes: { incluirDesativados?: boolean } = { incluirDesativados: true }
): Promise<number[]> {
    const linhas = await db
        .select({ id: users.id })
        .from(users)
        .where(motoboyScope(me, opcoes));
    return linhas.map((l) => l.id);
}
