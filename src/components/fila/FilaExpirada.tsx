"use client";

import { useEffect } from "react";

/**
 * O que o vendedor vê quando o código da fila não serve mais (venceu, ou nunca
 * existiu).
 *
 * O importante aqui não é o texto — é o recado pro EpicStore. Sem ele o painel
 * ficaria com um quadro parado na tela, e o vendedor sem entender por que os
 * botões sumiram. Recebendo o aviso, o EpicStore pede uma sessão nova
 * (POST /api/integration/queue-session) e recarrega o quadro sozinho.
 *
 * O formato do recado é contrato com o outro lado — não mudar sem combinar:
 *   { tipo: "zap-entregas:fila", evento: "expirada" }
 *
 * O destino é "*" pelo mesmo motivo que em /confirmar: o Zap não sabe de que
 * domínio é o painel que embutiu a página (cada loja pode ter o seu), e a
 * mensagem não leva nada sigiloso — só "acabou, peça outra".
 */
export default function FilaExpirada() {
    useEffect(() => {
        try {
            window.parent?.postMessage({ tipo: "zap-entregas:fila", evento: "expirada" }, "*");
            window.opener?.postMessage({ tipo: "zap-entregas:fila", evento: "expirada" }, "*");
        } catch {
            /* janela sem parente: só mostra o aviso abaixo */
        }
    }, []);

    return (
        <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center p-6">
            <div className="max-w-sm text-center space-y-3">
                <h1 className="text-xl font-bold text-white">A fila da loja expirou</h1>
                <p className="text-sm text-zinc-400">
                    Essa tela ficou aberta tempo demais. Feche e abra de novo pelo painel da loja
                    que ela volta com tudo.
                </p>
            </div>
        </div>
    );
}
