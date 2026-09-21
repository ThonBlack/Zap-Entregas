import { NextRequest, NextResponse } from "next/server";
import { autenticarChaveDeApi } from "@/lib/apiKeyAuth";
import { aplicarLimite } from "@/lib/rateLimit";
import { criarSessaoDaFila, limparNomeDoOperador } from "@/lib/queueSession";
import { absoluteUrl } from "@/lib/appUrl";
import { logServerError, logServerEvent } from "@/lib/serverLog";

/**
 * O EpicStore pede uma sessão da "Fila da loja".
 *
 * Contrato (combinado com o outro lado, NÃO mudar sem combinar de novo):
 *   POST /api/integration/queue-session
 *   Header:  X-API-KEY: zap_<id>_<acaso>     (a mesma chave do webhook de venda)
 *   Corpo:   { "operatorName": "Fulano" }    (opcional)
 *   200:     { "url": "https://…/fila/<token>", "expiresAt": "<ISO>" }
 *   401:     chave inválida ou loja desativada
 *   429:     muitas chamadas seguidas
 *
 * O EpicStore abre essa URL num quadro (iframe) dentro do painel dele. Quando o
 * prazo vence, a página avisa por postMessage e ele volta aqui pedir outra.
 */
export async function POST(request: NextRequest) {
    try {
        const loja = await autenticarChaveDeApi(request.headers.get("X-API-KEY"));

        if (!loja) {
            return NextResponse.json(
                { success: false, error: "API Key inválida ou lojista não encontrado" },
                { status: 401 }
            );
        }

        // Loja desativada não abre fila. Aqui dá pra recusar sem quebrar nada:
        // é funcionalidade nova. (O webhook de venda nunca conferiu isso e
        // continua como estava — ver o comentário em src/lib/apiKeyAuth.ts.)
        if (loja.isActive === false) {
            return NextResponse.json(
                { success: false, error: "Essa loja está desativada no Zap Entregas." },
                { status: 401 }
            );
        }

        const ritmo = aplicarLimite("filaSessao", `key:${loja.id}`);
        if (!ritmo.permitido) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Muitas chamadas seguidas. Tente de novo em ${ritmo.esperarSegundos} segundos.`,
                },
                { status: 429, headers: { "Retry-After": String(ritmo.esperarSegundos) } }
            );
        }

        // Corpo é opcional: PDV que só quer a fila manda POST sem nada. Corpo
        // quebrado não vira 500 — a sessão sai do mesmo jeito, sem o nome.
        let operatorName: string | null = null;
        try {
            const body = await request.json();
            if (body && typeof body === "object") {
                operatorName = limparNomeDoOperador((body as Record<string, unknown>).operatorName);
            }
        } catch {
            /* sem corpo, ou corpo ilegível: segue sem o nome do operador */
        }

        const { token, expiresAt } = await criarSessaoDaFila(loja.id, operatorName);

        await logServerEvent("fila_sessao_criada", `Fila aberta${operatorName ? ` por ${operatorName}` : ""}`, {
            page: "/api/integration/queue-session",
            userId: loja.id,
            operatorName,
            expiresAt,
        });

        return NextResponse.json({
            success: true,
            // SEMPRE absoluteUrl: dentro do container o servidor se enxerga como
            // localhost, então montar a partir de `request.url` devolveria um
            // endereço que só funciona na máquina dele (ver src/lib/appUrl.ts).
            url: absoluteUrl(`/fila/${token}`).toString(),
            expiresAt,
        });
    } catch (error) {
        console.error("Erro ao abrir sessão da fila:", error);
        await logServerError("fila_sessao", error, { page: "/api/integration/queue-session" });
        return NextResponse.json(
            { success: false, error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}
