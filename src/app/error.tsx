"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Erro de servidor numa página qualquer. Antes virava "Application error: a
 * server-side exception has occurred" — texto em inglês, sem botão nenhum.
 *
 * O `digest` é o código que o Next grava no log do servidor: mostrar na tela
 * deixa o Thon achar o erro no log sem adivinhação.
 */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[erro de página]", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center p-6">
            <div className="max-w-sm w-full text-center space-y-4">
                <div className="text-5xl" aria-hidden="true">⚠️</div>
                <h1 className="text-2xl font-bold text-white">Deu problema aqui</h1>
                <p className="text-zinc-400 text-sm leading-relaxed">
                    Não foi você. Alguma coisa falhou no nosso lado ao montar esta tela.
                    Tente de novo — se continuar, avise a loja.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                    <button
                        type="button"
                        onClick={reset}
                        className="inline-flex items-center justify-center min-h-11 px-6 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors"
                    >
                        Tentar de novo
                    </button>
                    <Link
                        href="/app"
                        className="inline-flex items-center justify-center min-h-11 px-6 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-zinc-800 font-medium transition-colors"
                    >
                        Voltar pro início
                    </Link>
                </div>
                {error.digest && (
                    <p className="text-[11px] text-zinc-600 font-mono pt-2">código: {error.digest}</p>
                )}
            </div>
        </div>
    );
}
