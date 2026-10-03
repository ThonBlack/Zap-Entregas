"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";

/**
 * "Quem faz essa corrida?" — a escolha do motoboy pela LOJA.
 *
 * Serve pras duas coisas que a loja passou a poder fazer: destinar uma corrida
 * a alguém da equipe (em vez de jogar na fila aberta) e dizer quem fez a
 * entrega na hora de marcar como entregue sem GPS. Nos dois casos o dono da
 * corrida é o que decide em qual carteira o dinheiro cai.
 */
export default function EscolherMotoboy({
    titulo, ajuda, motoboys, atual, permiteFila, salvando, erro, onCancelar, onEscolher,
}: {
    titulo: string;
    ajuda: string;
    motoboys: { id: number; name: string }[];
    atual: number | null;
    /** Mostra o "devolver pra fila" (só faz sentido ao destinar). */
    permiteFila: boolean;
    salvando: boolean;
    erro: string;
    onCancelar: () => void;
    onEscolher: (motoboyId: number | null) => void;
}) {
    const [escolhido, setEscolhido] = useState<number | null>(atual);

    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape" && !salvando) onCancelar(); };
        document.addEventListener("keydown", aoTeclar);
        return () => document.removeEventListener("keydown", aoTeclar);
    }, [onCancelar, salvando]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!salvando) onCancelar(); }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={titulo}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 rounded-full"><UserPlus className="w-6 h-6 text-indigo-600" /></div>
                    <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">{ajuda}</p>

                <div className="space-y-2 mb-4">
                    {motoboys.map((m) => (
                        <label
                            key={m.id}
                            className={`flex items-center gap-3 p-3 min-h-11 rounded-lg border cursor-pointer transition-colors ${escolhido === m.id ? "border-green-500 bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}
                        >
                            <input
                                type="radio"
                                name="motoboy-escolhido"
                                checked={escolhido === m.id}
                                onChange={() => setEscolhido(m.id)}
                                className="w-4 h-4 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-800">
                                {m.name}{atual === m.id ? " (está com ela)" : ""}
                            </span>
                        </label>
                    ))}
                    {permiteFila && (
                        <label className={`flex items-center gap-3 p-3 min-h-11 rounded-lg border cursor-pointer transition-colors ${escolhido === null ? "border-green-500 bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}>
                            <input
                                type="radio"
                                name="motoboy-escolhido"
                                checked={escolhido === null}
                                onChange={() => setEscolhido(null)}
                                className="w-4 h-4 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-800">↩️ Deixar na fila (qualquer motoboy pega)</span>
                        </label>
                    )}
                </div>

                {erro && <p className="mb-3 text-sm font-medium text-red-600">{erro}</p>}

                <div className="flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onCancelar}
                        disabled={salvando}
                        className="min-h-11 px-4 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-50"
                    >
                        Voltar
                    </button>
                    <button
                        type="button"
                        onClick={() => onEscolher(escolhido)}
                        disabled={salvando || (!permiteFila && escolhido === null)}
                        className="min-h-11 px-4 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {salvando && <Loader2 size={16} className="animate-spin" />}
                        {salvando ? "Salvando…" : "Confirmar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
