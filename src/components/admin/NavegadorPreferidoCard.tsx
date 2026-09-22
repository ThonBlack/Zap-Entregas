"use client";

import { useState } from "react";
import { Navigation } from "lucide-react";
import { NOME_DO_APP, type AppDeNavegacao } from "@/lib/mapsLink";
import { useNavegadorPreferido } from "@/components/shared/useNavegadorPreferido";

/** "perguntar" não é um aplicativo: é o estado de não ter escolhido nada. */
type Escolha = AppDeNavegacao | "perguntar";

const OPCOES: { valor: Escolha; titulo: string; ajuda: string }[] = [
    { valor: "maps", titulo: NOME_DO_APP.maps, ajuda: "Abre direto no Google Maps" },
    { valor: "waze", titulo: NOME_DO_APP.waze, ajuda: "Abre direto no Waze" },
    { valor: "perguntar", titulo: "Perguntar sempre", ajuda: "Escolho na hora, a cada corrida" },
];

/**
 * "Navegar com": em qual aplicativo o botão Navegar abre o endereço.
 *
 * Não vai pro banco — é do CELULAR (localStorage). Por isso o aviso na tela: se
 * o motoboy entrar por outro aparelho, a escolha começa do zero lá.
 *
 * A leitura acontece depois da montagem porque no servidor não existe
 * localStorage; até lá o cartão mostra o "Perguntar sempre", que é o padrão.
 */
export default function NavegadorPreferidoCard() {
    const { navegador, escolher: gravar } = useNavegadorPreferido();
    const [salvo, setSalvo] = useState(false);
    const escolha: Escolha = navegador ?? "perguntar";

    const escolher = (valor: Escolha) => {
        gravar(valor === "perguntar" ? null : valor);
        setSalvo(true);
    };

    return (
        <div className="bg-zinc-800 rounded-2xl border border-zinc-700 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Navigation className="text-white" size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">Navegar com</h3>
                    <p className="text-sm text-zinc-400">Qual aplicativo abre quando você toca em Navegar</p>
                </div>
            </div>

            <div className="space-y-2">
                {OPCOES.map((o) => (
                    <label
                        key={o.valor}
                        className={`flex items-center gap-3 p-3 min-h-11 rounded-lg border cursor-pointer transition-colors ${escolha === o.valor
                            ? "border-green-500 bg-green-600/10"
                            : "border-zinc-700 hover:bg-zinc-700"
                            }`}
                    >
                        <input
                            type="radio"
                            name="navegador-preferido"
                            checked={escolha === o.valor}
                            onChange={() => escolher(o.valor)}
                            className="w-5 h-5 border-zinc-600 bg-zinc-700 text-green-500 focus:ring-green-500"
                        />
                        <span className="min-w-0">
                            <span className="block text-sm font-bold text-white">{o.titulo}</span>
                            <span className="block text-xs text-zinc-400">{o.ajuda}</span>
                        </span>
                    </label>
                ))}
            </div>

            <p className="mt-3 text-xs text-zinc-500">
                {salvo ? "✓ Salvo neste celular." : "A escolha fica guardada só neste celular."}
            </p>
        </div>
    );
}
