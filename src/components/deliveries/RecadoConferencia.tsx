"use client";

import { useEffect, useState } from "react";

/**
 * O que o caixa vê quando o link de conferência não serve mais.
 *
 * O importante aqui é o aviso pro PDV: no caminho de erro NADA era mandado, e a
 * venda ficava esperando pra sempre um evento que nunca vinha — com o caixa
 * preso numa tela dentro do iframe, sem botão nenhum pra sair.
 */
export default function RecadoConferencia({
    titulo,
    texto,
    resultado,
}: {
    titulo: string;
    texto: string;
    resultado: "expirado" | "invalido" | "ja_liberada" | "cancelada";
}) {
    const [dentroDeIframe, setDentroDeIframe] = useState(false);

    useEffect(() => {
        setDentroDeIframe(window.parent !== window);
        const recado = { tipo: "zap-entregas:conferencia", resultado };
        try {
            window.parent?.postMessage(recado, "*");
            window.opener?.postMessage(recado, "*");
        } catch {
            /* janela sem parente: só mostra o aviso */
        }
    }, [resultado]);

    return (
        <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center p-6">
            <div className="max-w-sm text-center space-y-3">
                <h1 className="text-xl font-bold text-white">{titulo}</h1>
                <p className="text-zinc-400 text-sm">{texto}</p>
                <p className="text-zinc-500 text-xs">
                    {dentroDeIframe ? "Pode voltar pra venda." : "Pode fechar esta janela."}
                </p>
            </div>
        </div>
    );
}
