"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, ThumbsUp } from "lucide-react";

import { confirmDailyClosingAction, disputeDailyClosingAction } from "@/app/actions/dailyClosing";

/**
 * Os dois botões do motoboy no fechamento do dia: "Está certo" e "Está errado".
 * Contestar exige escrever o que está errado — senão a loja não sabe o que olhar.
 */
export default function FechamentoRespostaBotoes({ closingId }: { closingId: number }) {
    const router = useRouter();
    const [pendente, iniciar] = useTransition();
    const [erro, setErro] = useState<string | null>(null);
    const [contestando, setContestando] = useState(false);
    const [texto, setTexto] = useState("");

    function confirmar() {
        setErro(null);
        iniciar(async () => {
            const r = await confirmDailyClosingAction(closingId);
            if ("error" in r) { setErro(r.error); return; }
            router.refresh();
        });
    }

    function contestar() {
        setErro(null);
        iniciar(async () => {
            const r = await disputeDailyClosingAction(closingId, texto);
            if ("error" in r) { setErro(r.error); return; }
            setContestando(false);
            router.refresh();
        });
    }

    return (
        <div className="space-y-3">
            {erro && (
                <div className="bg-red-900/30 border border-red-700/50 text-red-300 p-3 rounded-xl flex items-start gap-2 text-sm">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span>{erro}</span>
                </div>
            )}

            {contestando ? (
                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-white" htmlFor={`erro-${closingId}`}>
                        O que está errado?
                    </label>
                    <textarea
                        id={`erro-${closingId}`}
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Ex.: a corrida da Rua das Flores eu recebi em PIX, não em dinheiro"
                        className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => { setContestando(false); setErro(null); }}
                            disabled={pendente}
                            className="min-h-11 flex items-center justify-center bg-zinc-700 border border-zinc-600 text-white rounded-xl font-bold text-sm hover:bg-zinc-600 disabled:opacity-60"
                        >
                            Voltar
                        </button>
                        <button
                            type="button"
                            onClick={contestar}
                            disabled={pendente}
                            className="min-h-11 flex items-center justify-center gap-2 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-600 disabled:opacity-60"
                        >
                            {pendente ? <Loader2 size={16} className="animate-spin" /> : <AlertCircle size={16} />}
                            Enviar pra loja
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => { setContestando(true); setErro(null); }}
                        disabled={pendente}
                        className="min-h-11 flex items-center justify-center gap-2 bg-zinc-700 border border-zinc-600 text-white rounded-xl font-bold text-sm hover:bg-zinc-600 disabled:opacity-60"
                    >
                        <AlertCircle size={16} /> Está errado
                    </button>
                    <button
                        type="button"
                        onClick={confirmar}
                        disabled={pendente}
                        className="min-h-11 flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-500 disabled:opacity-60"
                    >
                        {pendente ? <Loader2 size={16} className="animate-spin" /> : <ThumbsUp size={16} />}
                        Está certo
                    </button>
                </div>
            )}

            {!contestando && (
                <p className="text-xs text-zinc-500 flex items-start gap-1.5">
                    <Check size={14} className="shrink-0 mt-0.5" />
                    Confirmar não paga nem cobra nada — é só você dizer que a conta do dia bate.
                </p>
            )}
        </div>
    );
}
