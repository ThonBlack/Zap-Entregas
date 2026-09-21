"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bike, Loader2 } from "lucide-react";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import { lancarCorridaDaFilaAction } from "@/app/actions/queue";
import {
    CHARGE_MODES,
    CHARGE_MODE_AJUDA,
    CHARGE_MODE_LABEL,
    type ChargeMode,
} from "@/lib/chargeMode";

/**
 * "Lançar corrida" — o pedido que não veio do PDV (cliente ligou, passou na
 * loja) sendo digitado pelo vendedor.
 *
 * É de propósito que esta tela seja CURTA. O que ficou de fora:
 *  - escolher motoboy: é decisão de operação, a loja faz pelo aplicativo;
 *  - data de outro dia: mexe no fechamento do dia, que é dinheiro;
 *  - taxa do motoboy: idem — nada de financeiro passa pela mão do vendedor.
 *
 * Todas as cores são escritas na mão (fundo E texto em cada campo). O app já
 * teve texto invisível por herdar a cor de fora no modo escuro do navegador —
 * aqui a tela vive DENTRO do painel do EpicStore, então herdar é ainda pior.
 */
export default function NovaCorridaDaFilaForm({
    queueToken,
    voltarPara,
    defaultCity,
    defaultState,
    shopLat,
    shopLng,
}: {
    queueToken: string;
    voltarPara: string;
    defaultCity: string | null;
    defaultState: string | null;
    shopLat: number | null;
    shopLng: number | null;
}) {
    const router = useRouter();
    const [erro, setErro] = useState("");
    const [cobranca, setCobranca] = useState<ChargeMode>("receber");
    const [salvando, startTransition] = useTransition();

    const pedeValor = cobranca !== "pago";

    const enviar = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErro("");
        const fd = new FormData(e.currentTarget);
        fd.set("queueToken", queueToken);
        startTransition(async () => {
            const res = await lancarCorridaDaFilaAction(fd);
            if (res && "error" in res) { setErro(res.error); return; }
            router.push(voltarPara);
            router.refresh();
        });
    };

    const campo =
        "w-full px-3 py-2.5 min-h-11 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 outline-none focus:border-green-500";

    return (
        <form onSubmit={enviar} className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Endereço da entrega
                </label>
                <AddressAutocomplete
                    name="address"
                    defaultCity={defaultCity ?? "Uberaba"}
                    defaultState={defaultState ?? "MG"}
                    shopLat={shopLat}
                    shopLng={shopLng}
                    filaToken={queueToken}
                    required
                />
                <p className="text-xs text-zinc-500 mt-1">
                    Comece a digitar e escolha na lista — assim o motoboy recebe o ponto certo no mapa.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="fila-cliente" className="block text-sm font-medium text-zinc-300 mb-2">
                        Cliente
                    </label>
                    <input id="fila-cliente" name="customerName" className={campo} placeholder="Nome de quem recebe" />
                </div>
                <div>
                    <label htmlFor="fila-telefone" className="block text-sm font-medium text-zinc-300 mb-2">
                        Telefone (opcional)
                    </label>
                    <input id="fila-telefone" name="customerPhone" inputMode="tel" className={campo} placeholder="(34) 9…" />
                </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700 space-y-3">
                <p className="text-sm font-medium text-white">Como esse pedido é pago?</p>
                <input type="hidden" name="chargeMode" value={cobranca} />
                <div className="space-y-2">
                    {CHARGE_MODES.map((modo) => (
                        <label
                            key={modo}
                            className={`flex items-start gap-3 p-3 min-h-11 rounded-lg border cursor-pointer transition-colors ${cobranca === modo ? "border-green-500 bg-green-500/10" : "border-zinc-600 bg-zinc-800 hover:bg-zinc-700/60"}`}
                        >
                            <input
                                type="radio"
                                name="chargeModeRadio"
                                checked={cobranca === modo}
                                onChange={() => setCobranca(modo)}
                                className="mt-0.5 w-5 h-5 accent-green-600"
                            />
                            <span>
                                <span className="block text-sm font-medium text-white">
                                    {modo === "receber" ? "💵 " : modo === "conferir" ? "🔎 " : "✅ "}
                                    {CHARGE_MODE_LABEL[modo]}
                                </span>
                                <span className="block text-xs text-zinc-400">{CHARGE_MODE_AJUDA[modo]}</span>
                            </span>
                        </label>
                    ))}
                </div>

                {pedeValor && (
                    <div>
                        <label htmlFor="fila-valor" className="block text-xs text-zinc-400 mb-1">
                            {cobranca === "conferir" ? "Valor do Pix (R$)" : "Quanto receber (R$)"}
                        </label>
                        <input
                            id="fila-valor"
                            name="value"
                            inputMode="decimal"
                            placeholder="0,00"
                            className={campo}
                        />
                    </div>
                )}
            </div>

            <div>
                <label htmlFor="fila-obs" className="block text-sm font-medium text-zinc-300 mb-2">
                    Observação pro motoboy
                </label>
                <textarea
                    id="fila-obs"
                    name="observation"
                    rows={3}
                    placeholder="Ex.: portão azul, chamar no interfone, entregar na portaria…"
                    className="w-full px-3 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 outline-none focus:border-green-500"
                />
            </div>

            {erro && (
                <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3">
                    {erro}
                </p>
            )}

            <div className="flex flex-col-reverse md:flex-row gap-3 pt-1">
                <button
                    type="button"
                    onClick={() => router.push(voltarPara)}
                    disabled={salvando}
                    className="flex-1 flex items-center justify-center gap-2 min-h-11 px-4 py-3 rounded-xl border border-zinc-600 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                    Voltar sem lançar
                </button>
                <button
                    type="submit"
                    disabled={salvando}
                    className="flex-[2] flex items-center justify-center gap-2 min-h-11 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors disabled:opacity-50"
                >
                    {salvando ? <Loader2 size={18} className="animate-spin" /> : <Bike size={18} />}
                    Lançar pros motoboys
                </button>
            </div>
        </form>
    );
}
