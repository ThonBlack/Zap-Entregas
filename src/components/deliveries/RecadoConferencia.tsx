"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * "Esta janela está dentro de um iframe?" — pergunta que só o navegador responde.
 *
 * useSyncExternalStore com resposta separada pro servidor é o jeito certo de ler
 * algo do navegador sem chamar setState dentro de um efeito (que provoca uma
 * segunda renderização em cascata) e sem quebrar a hidratação.
 */
const nuncaMuda = () => () => { };
const lerNoNavegador = () => window.parent !== window;
const lerNoServidor = () => false;

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
    const dentroDeIframe = useSyncExternalStore(nuncaMuda, lerNoNavegador, lerNoServidor);

    useEffect(() => {
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
