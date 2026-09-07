import { db } from "@/db";
import { appLogs } from "@/db/schema";

/**
 * Registra um erro do SERVIDOR na tabela `app_logs`.
 *
 * A tabela existia e só o navegador escrevia nela (`POST /api/logs`). Toda falha
 * de servidor — geocode que quebrou, erro ao finalizar entrega, erro interno do
 * webhook do PDV — ia só pro stdout do container: pra investigar era preciso
 * `docker logs` e torcer pra linha não ter rolado. Justamente nos caminhos que
 * mexem com dinheiro.
 *
 * Regras desta função:
 *  - NUNCA lança. Log que derruba a ação é pior que log nenhum.
 *  - NUNCA substitui o `console.error` — os dois convivem.
 *  - Corta o texto pra uma linha de log não engordar o `sqlite.db` (que é o
 *    mesmo arquivo dos dados de negócio).
 */

const LIMITE_MENSAGEM = 500;
const LIMITE_STACK = 2000;
const LIMITE_METADATA = 2000;

export type MetaDoLog = {
    /** Tela ou rota onde aconteceu (ex.: "/confirmar", "/api/integration/delivery"). */
    page?: string | null;
    userId?: number | null;
    /** Qualquer dado extra que ajude a entender (ids, valores). Vira JSON. */
    [chave: string]: unknown;
};

function textoDoErro(err: unknown): { message: string; stack: string | null } {
    if (err instanceof Error) {
        return {
            message: err.message.slice(0, LIMITE_MENSAGEM),
            stack: err.stack ? err.stack.slice(0, LIMITE_STACK) : null,
        };
    }
    return { message: String(err ?? "erro sem descrição").slice(0, LIMITE_MENSAGEM), stack: null };
}

export async function logServerError(event: string, err: unknown, meta: MetaDoLog = {}): Promise<void> {
    try {
        const { page = null, userId = null, ...extra } = meta;
        const { message, stack } = textoDoErro(err);

        let metadata: string | null = null;
        if (Object.keys(extra).length) {
            try {
                metadata = JSON.stringify(extra).slice(0, LIMITE_METADATA);
            } catch {
                metadata = null; // objeto circular: melhor sem metadata do que sem log
            }
        }

        await db.insert(appLogs).values({
            level: "error",
            event: String(event).slice(0, 100),
            message,
            userId: typeof userId === "number" ? userId : null,
            page: page ? String(page).slice(0, 200) : null,
            stack,
            metadata,
            createdAt: new Date().toISOString(),
        });
    } catch {
        // Banco fora do ar / tabela ausente: o console.error de quem chamou já
        // guardou o essencial. Não dá pra deixar o log derrubar a operação.
    }
}
