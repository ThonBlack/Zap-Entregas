import "server-only";

import { db } from "@/db";
import { passwordResets } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Aposenta todos os links de "esqueci a senha" que ainda estavam de pé.
 *
 * Cada pedido de recuperação criava mais uma linha e nenhuma das anteriores era
 * invalidada — todas continuavam valendo até vencer sozinhas. E trocar a senha
 * por qualquer outro caminho (a tela de Configurações, o "Redefinir acesso" da
 * loja, o painel do admin) também não mexia nelas.
 *
 * O resultado é uma janela de retomada de conta: quem tiver visto um link
 * antigo — no e-mail, no histórico do navegador, em cima do ombro — ainda
 * consegue usá-lo DEPOIS de a pessoa já ter trocado a senha justamente porque
 * desconfiou de alguma coisa.
 *
 * Chamar sempre que a senha muda e sempre que um link novo é emitido.
 * Nunca lança: um link antigo que sobrou é ruim, mas derrubar a troca de senha
 * por causa disso é pior.
 */
export async function invalidarLinksDeSenha(userId: number): Promise<void> {
    if (!Number.isInteger(userId) || userId <= 0) return;
    try {
        await db.update(passwordResets)
            .set({ usedAt: new Date().toISOString() })
            .where(and(
                eq(passwordResets.userId, userId),
                isNull(passwordResets.usedAt),
            ));
    } catch (e) {
        console.error("[SENHA] não consegui aposentar os links antigos:", e);
    }
}
