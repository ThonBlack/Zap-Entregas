"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";

import { adjustDeliveryReceiptAction } from "@/app/actions/dailyClosing";
import { chargeModeDaCorrida } from "@/lib/chargeMode";

/**
 * "Corrigir recebimento" de uma corrida JÁ ENTREGUE, direto do histórico.
 *
 * A mesma correção já existia no "Resumo do dia", mas só alcançava as corridas
 * do dia que a loja estava fechando. Entrega de terça que a loja só percebeu na
 * sexta ficava errada pra sempre — e "errada" aqui quer dizer dinheiro a mais
 * ou a menos na conta do motoboy.
 *
 * Usa a MESMA server action (adjustDeliveryReceiptAction), que é quem conserta
 * a carteira junto, numa transação: tirar o valor ("não recebeu" / "já estava
 * pago") apaga o débito do dinheiro em espécie; colocar, cria.
 */

type Props = {
    deliveryId: number;
    fee: number | null;
    receiptStatus: "recebido" | "valor_diferente" | "nao_recebido" | "nada_a_receber" | null;
    receivedAmount: number | null;
    receivedMethod: "dinheiro" | "pix" | "cartao" | null;
    chargeMode?: string | null;
    value?: number | null;
};

const STATUS_OPCOES = [
    { valor: "recebido", label: "Recebeu do cliente" },
    { valor: "valor_diferente", label: "Recebeu valor diferente" },
    { valor: "nao_recebido", label: "Não recebeu" },
    { valor: "nada_a_receber", label: "Já estava pago" },
] as const;

/** Dinheiro em texto pro campo de edição: 12.5 → "12,50". */
function paraCampo(n: number | null | undefined): string {
    if (n == null) return "";
    return n.toFixed(2).replace(".", ",");
}

export default function CorrigirRecebimento(props: Props) {
    const router = useRouter();
    const [aberto, setAberto] = useState(false);
    const [pendente, iniciar] = useTransition();
    const [erro, setErro] = useState<string | null>(null);
    const [ok, setOk] = useState(false);

    const [fee, setFee] = useState(paraCampo(props.fee));
    const [status, setStatus] = useState(props.receiptStatus ?? "nada_a_receber");
    const [valor, setValor] = useState(paraCampo(props.receivedAmount));
    const [metodo, setMetodo] = useState(props.receivedMethod ?? "");

    const pediuValor = status === "recebido" || status === "valor_diferente";
    const modo = chargeModeDaCorrida({ chargeMode: props.chargeMode, value: props.value });

    function salvar() {
        setErro(null);
        iniciar(async () => {
            const r = await adjustDeliveryReceiptAction({
                deliveryId: props.deliveryId,
                fee,
                receiptStatus: status,
                receivedAmount: pediuValor ? valor : "0",
                receivedMethod: pediuValor ? (metodo as "dinheiro" | "pix" | "cartao") : "",
            });
            if ("error" in r) { setErro(r.error); return; }
            setOk(true);
            setAberto(false);
            router.refresh();
        });
    }

    if (!aberto) {
        return (
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={() => { setOk(false); setAberto(true); }}
                    className="min-h-11 px-3 inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-700 text-sm font-bold text-white hover:bg-zinc-600 transition-colors"
                >
                    <Pencil size={16} />
                    Corrigir recebimento
                </button>
                {ok && <span className="text-xs text-green-400">Corrigido ✓</span>}
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-zinc-600 bg-zinc-900/60 p-3 space-y-3">
            {modo === "conferir" && (
                <p className="text-[11px] text-sky-300">
                    Corrida de Pix da loja: marcar como PIX <strong>não</strong> tira nada da conta do motoboy.
                    Só dinheiro em espécie entra no que ele tem pra devolver.
                </p>
            )}

            <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-400">
                    Taxa da corrida
                    <input
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        inputMode="decimal"
                        className="mt-1 w-full p-2 min-h-11 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </label>
                <label className="text-xs text-zinc-400">
                    O que aconteceu
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as typeof status)}
                        className="mt-1 w-full p-2 min-h-11 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        {STATUS_OPCOES.map((o) => (
                            <option key={o.valor} value={o.valor}>{o.label}</option>
                        ))}
                    </select>
                </label>
            </div>

            {pediuValor && (
                <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-zinc-400">
                        Quanto recebeu
                        <input
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            inputMode="decimal"
                            className="mt-1 w-full p-2 min-h-11 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </label>
                    <label className="text-xs text-zinc-400">
                        Como pagou
                        <select
                            value={metodo}
                            onChange={(e) => setMetodo(e.target.value as typeof metodo)}
                            className="mt-1 w-full p-2 min-h-11 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="">Escolha...</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="pix">PIX</option>
                            <option value="cartao">Cartão</option>
                        </select>
                    </label>
                </div>
            )}

            <p className="text-[11px] text-zinc-500">
                Só dinheiro em espécie entra na conta do que o motoboy tem pra devolver. PIX e cartão caem direto na loja.
            </p>

            {erro && (
                <div className="bg-red-900/30 border border-red-700/50 text-red-300 p-2 rounded-lg text-xs">{erro}</div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => { setAberto(false); setErro(null); }}
                    disabled={pendente}
                    className="min-h-11 flex items-center justify-center gap-2 bg-zinc-700 border border-zinc-600 text-white rounded-xl font-bold text-sm hover:bg-zinc-600 disabled:opacity-60"
                >
                    <X size={16} /> Cancelar
                </button>
                <button
                    type="button"
                    onClick={salvar}
                    disabled={pendente}
                    className="min-h-11 flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-500 disabled:opacity-60"
                >
                    {pendente ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Salvar
                </button>
            </div>
        </div>
    );
}
