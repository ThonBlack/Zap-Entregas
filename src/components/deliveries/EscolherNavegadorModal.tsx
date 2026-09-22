"use client";

import { useEffect, useState } from "react";
import { Navigation } from "lucide-react";
import type { AppDeNavegacao } from "@/lib/mapsLink";

/**
 * "Abrir com qual aplicativo?" — a escolha entre Google Maps e Waze na primeira
 * vez que o motoboy toca em "Navegar".
 *
 * Dois botões grandes porque isso é tocado de capacete, com a moto ligada. O
 * "Lembrar minha escolha" já vem marcado: a ideia é perguntar UMA vez e nunca
 * mais (dá pra mudar depois nas Configurações).
 *
 * `onEscolher` é chamada DENTRO do clique e precisa abrir o link na hora, sem
 * `await` antes: se abrir depois de uma espera, o navegador do celular trata
 * como pop-up e bloqueia em silêncio.
 */
export default function EscolherNavegadorModal({
    endereco, onEscolher, onCancelar,
}: {
    /** Pra que endereço é a navegação — só pra pessoa conferir antes de abrir. */
    endereco: string;
    onEscolher: (app: AppDeNavegacao, lembrar: boolean) => void;
    onCancelar: () => void;
}) {
    const [lembrar, setLembrar] = useState(true);

    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onCancelar(); };
        document.addEventListener("keydown", aoTeclar);
        return () => document.removeEventListener("keydown", aoTeclar);
    }, [onCancelar]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onCancelar}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Abrir com qual aplicativo"
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 rounded-full"><Navigation className="w-6 h-6 text-blue-600" /></div>
                    <h3 className="text-lg font-bold text-gray-900">Abrir com qual aplicativo?</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4 break-words">{endereco}</p>

                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={() => onEscolher("maps", lembrar)}
                        className="w-full min-h-14 px-4 rounded-xl font-bold text-base bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center gap-2"
                    >
                        <Navigation size={18} />
                        Google Maps
                    </button>
                    <button
                        type="button"
                        onClick={() => onEscolher("waze", lembrar)}
                        className="w-full min-h-14 px-4 rounded-xl font-bold text-base bg-sky-500 hover:bg-sky-600 text-white transition-colors flex items-center justify-center gap-2"
                    >
                        <Navigation size={18} />
                        Waze
                    </button>
                </div>

                <label className="mt-4 flex items-center gap-3 p-3 min-h-11 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={lembrar}
                        onChange={(e) => setLembrar(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-800">Lembrar minha escolha</span>
                </label>
                <p className="mt-2 text-xs text-gray-500">
                    Dá pra trocar depois em Configurações → Navegar com.
                </p>

                <div className="flex justify-end mt-5">
                    <button
                        type="button"
                        onClick={onCancelar}
                        className="min-h-11 px-4 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                        Voltar
                    </button>
                </div>
            </div>
        </div>
    );
}
