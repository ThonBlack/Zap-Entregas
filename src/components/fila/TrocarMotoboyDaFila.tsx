"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { trocarMotoboyDaFilaAction } from "@/app/actions/filaMotoboy";

/**
 * "Trocar motoboy" de cada corrida da fila que ainda não foi coletada.
 *
 * Abre ali mesmo, no card: um seletor com a equipe da loja e o "Qualquer um
 * (fila aberta)". Nada de modal por cima — o vendedor está no balcão com o
 * painel do EpicStore em volta, e um card que se abre é mais fácil de largar.
 *
 * A lista de motoboys vem do servidor já filtrada pela loja da sessão; mesmo
 * assim quem decide se o escolhido vale é a ação (src/app/actions/filaMotoboy.ts).
 */
export default function TrocarMotoboyDaFila({
    deliveryId,
    queueToken,
    motoboyAtual,
    nomeAtual,
    motoboys,
}: {
    deliveryId: number;
    queueToken: string;
    /** Quem está com a corrida agora. `null` = na fila aberta. */
    motoboyAtual: number | null;
    /** Nome de quem está com ela — pode não estar na equipe (o admin destinou a um "da casa"). */
    nomeAtual?: string | null;
    motoboys: { id: number; name: string }[];
}) {
    const router = useRouter();
    const [aberto, setAberto] = useState(false);
    const [escolha, setEscolha] = useState(motoboyAtual != null ? String(motoboyAtual) : "");
    const [erro, setErro] = useState("");
    const [salvando, startTransition] = useTransition();

    const abrir = () => {
        setEscolha(motoboyAtual != null ? String(motoboyAtual) : "");
        setErro("");
        setAberto(true);
    };

    const salvar = () => {
        setErro("");
        const fd = new FormData();
        fd.set("id", String(deliveryId));
        fd.set("queueToken", queueToken);
        fd.set("motoboyId", escolha);
        startTransition(async () => {
            const res = await trocarMotoboyDaFilaAction(fd);
            if (res && "error" in res) { setErro(res.error); return; }
            setAberto(false);
            router.refresh();
        });
    };

    if (!aberto) {
        return (
            <button
                type="button"
                onClick={abrir}
                className="flex-1 flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl border border-indigo-500/50 bg-zinc-900 text-indigo-200 font-medium hover:bg-indigo-500/10 transition-colors"
            >
                <UserPlus size={16} />
                {motoboyAtual != null ? "Trocar motoboy" : "Escolher motoboy"}
            </button>
        );
    }

    const semMudanca = escolha === (motoboyAtual != null ? String(motoboyAtual) : "");

    return (
        <div className="w-full rounded-xl border border-indigo-500/40 bg-zinc-900 p-3 space-y-2">
            <label htmlFor={`trocar-${deliveryId}`} className="block text-sm font-medium text-zinc-200">
                Quem leva essa corrida?
            </label>
            <select
                id={`trocar-${deliveryId}`}
                value={escolha}
                onChange={(e) => setEscolha(e.target.value)}
                disabled={salvando}
                className="w-full px-3 py-2.5 min-h-11 rounded-lg border border-zinc-600 bg-zinc-700 text-white outline-none focus:border-green-500"
            >
                <option value="">Qualquer um (fila aberta)</option>
                {motoboyAtual != null && !motoboys.some((m) => m.id === motoboyAtual) && (
                    <option value={motoboyAtual}>{nomeAtual ?? "Motoboy atual"} (está com ela)</option>
                )}
                {motoboys.map((m) => (
                    <option key={m.id} value={m.id}>
                        {m.name}{m.id === motoboyAtual ? " (está com ela)" : ""}
                    </option>
                ))}
            </select>
            <p className="text-xs text-zinc-400">
                Quem sair da corrida é avisado no celular. O escolhido recebe o aviso e não precisa aceitar.
            </p>
            {erro && <p className="text-sm text-red-300">{erro}</p>}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setAberto(false)}
                    disabled={salvando}
                    className="flex-1 min-h-11 px-4 py-2 rounded-xl border border-zinc-600 text-zinc-200 font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                    Voltar
                </button>
                <button
                    type="button"
                    onClick={salvar}
                    disabled={salvando || semMudanca}
                    className="flex-1 flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                    {salvando && <Loader2 size={16} className="animate-spin" />}
                    {salvando ? "Salvando…" : "Confirmar"}
                </button>
            </div>
        </div>
    );
}
