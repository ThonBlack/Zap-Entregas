"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, Pencil, Send, RotateCcw, X } from "lucide-react";

import {
    adjustDeliveryReceiptAction,
    sendDailyClosingAction,
    reopenDailyClosingAction,
} from "@/app/actions/dailyClosing";
import type { DailySummary, DailySummaryLine } from "@/lib/dailySummary";
import { formatBRL } from "@/lib/wallet-shared";
import { fmtTime, fmtDateTime } from "@/lib/datetime";
import { rotuloCorrida } from "@/lib/dailySeq-shared";
import {
    RECEIPT_METHOD_LABEL,
    RECEIPT_STATUS_LABEL,
    fechamentoDivergente,
    textoLiquido,
    tomLiquido,
    type ClosingStatus,
} from "@/lib/dailyClosing-shared";

export type ClosingResumo = {
    id: number;
    status: ClosingStatus;
    note: string | null;
    motoboyNote: string | null;
    sentAt: string | null;
    respondedAt: string | null;
    /** Totais CONGELADOS no envio (ou na última confirmação) — a régua que o motoboy está vendo. */
    deliveriesCount: number;
    feesTotal: number;
    cashTotal: number;
    pixTotal: number;
    cardTotal: number;
    net: number;
} | null;

type Props = {
    motoboyId: number;
    motoboyName: string;
    summary: DailySummary;
    closing: ClosingResumo;
    /** Loja consegue mexer (lojista dono ou admin). */
    podeEditar: boolean;
};

/** Dinheiro em texto pro campo de edição: 12.5 → "12,50". */
function paraCampo(n: number | null | undefined): string {
    if (n == null) return "";
    return n.toFixed(2).replace(".", ",");
}

export default function ResumoDoDia({ motoboyId, motoboyName, summary, closing, podeEditar }: Props) {
    const router = useRouter();
    const [pendente, iniciar] = useTransition();
    const [erro, setErro] = useState<string | null>(null);
    const [editando, setEditando] = useState<number | null>(null);
    const [recado, setRecado] = useState(closing?.note ?? "");
    const [avisoCorrecao, setAvisoCorrecao] = useState(false);

    const confirmado = closing?.status === "confirmed";
    const travado = confirmado || !podeEditar;

    // Fechamento já enviado (ou confirmado) com totais que não batem mais com
    // o resumo vivo: a loja corrigiu alguma corrida depois e não reenviou.
    const divergencia = closing
        ? fechamentoDivergente(
            {
                deliveriesCount: closing.deliveriesCount,
                feesTotal: closing.feesTotal,
                cashTotal: closing.cashTotal,
                pixTotal: closing.pixTotal,
                cardTotal: closing.cardTotal,
                net: closing.net,
            },
            {
                deliveriesCount: summary.deliveriesCount,
                feesTotal: summary.feesTotal,
                cashTotal: summary.cashTotal,
                pixTotal: summary.pixTotal,
                cardTotal: summary.cardTotal,
                net: summary.net,
            },
        )
        : null;
    const divergente = divergencia?.divergente ?? false;

    function enviar() {
        setErro(null);
        iniciar(async () => {
            const r = await sendDailyClosingAction(motoboyId, summary.day, recado);
            if ("error" in r) { setErro(r.error); return; }
            router.refresh();
        });
    }

    function reabrir() {
        setErro(null);
        iniciar(async () => {
            const r = await reopenDailyClosingAction(motoboyId, summary.day);
            if ("error" in r) { setErro(r.error); return; }
            router.refresh();
        });
    }

    const tom = tomLiquido(summary.net);
    const corLiquido = {
        green: "bg-green-700 border-green-600",
        red: "bg-red-800 border-red-700",
        zinc: "bg-zinc-700 border-zinc-600",
    }[tom];

    return (
        <div className="space-y-4">
            {closing && <FaixaStatus closing={closing} />}

            {/* Líquido do dia, em português */}
            <div className={`rounded-2xl border p-5 text-white ${corLiquido}`}>
                <p className="text-xs uppercase tracking-wide opacity-80">Resultado do dia</p>
                <p className="text-xl font-bold mt-1">{textoLiquido(summary.net, "loja")}</p>
                <p className="text-xs opacity-80 mt-2">
                    {formatBRL(summary.feesTotal)} de taxa − {formatBRL(summary.cashTotal)} em dinheiro na mão dele
                </p>
            </div>

            {/* Totais */}
            <div className="grid grid-cols-2 gap-2 text-sm">
                <Total label="Corridas" valor={String(summary.deliveriesCount)} />
                <Total label="Taxas" valor={formatBRL(summary.feesTotal)} cor="text-green-400" />
                <Total label="Dinheiro recebido" valor={formatBRL(summary.cashTotal)} cor="text-red-400" />
                <Total label="PIX" valor={formatBRL(summary.pixTotal)} />
                <Total label="Cartão" valor={formatBRL(summary.cardTotal)} />
                {summary.adjustmentsTotal !== 0 && (
                    <Total
                        label="Ajustes do dia (fora do total)"
                        valor={formatBRL(Math.abs(summary.adjustmentsTotal))}
                        cor={summary.adjustmentsTotal > 0 ? "text-green-400" : "text-red-400"}
                    />
                )}
            </div>

            {erro && (
                <div className="bg-red-900/30 border border-red-700/50 text-red-300 p-3 rounded-xl flex items-start gap-2 text-sm">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span>{erro}</span>
                </div>
            )}

            {/* Corridas do dia */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl divide-y divide-zinc-700 overflow-hidden">
                <div className="px-4 py-3 text-sm font-semibold text-zinc-300">
                    Corridas de {motoboyName.split(" ")[0]} neste dia
                </div>
                {summary.lines.length === 0 ? (
                    <p className="p-6 text-center text-zinc-400 text-sm">
                        Nenhuma corrida entregue neste dia.
                    </p>
                ) : (
                    summary.lines.map((linha) =>
                        editando === linha.id ? (
                            <LinhaEdicao
                                key={linha.id}
                                linha={linha}
                                onCancelar={() => setEditando(null)}
                                onSalvo={(fechamentoDesatualizado) => {
                                    setEditando(null);
                                    if (fechamentoDesatualizado) setAvisoCorrecao(true);
                                    router.refresh();
                                }}
                            />
                        ) : (
                            <LinhaLeitura
                                key={linha.id}
                                linha={linha}
                                podeEditar={!travado}
                                onEditar={() => { setErro(null); setEditando(linha.id); }}
                            />
                        )
                    )
                )}
            </div>

            {/* Recado + envio */}
            {podeEditar && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-3">
                    <label className="block text-sm font-semibold text-zinc-300" htmlFor="recado">
                        Observação pro motoboy (opcional)
                    </label>
                    <textarea
                        id="recado"
                        value={recado}
                        onChange={(e) => setRecado(e.target.value)}
                        disabled={travado || pendente}
                        rows={2}
                        maxLength={500}
                        placeholder="Ex.: a corrida da Rua X eu paguei em dinheiro adiantado"
                        className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                    />

                    {avisoCorrecao && (
                        <div className="bg-yellow-500/10 border border-yellow-500/40 text-yellow-200 p-3 rounded-xl flex items-start justify-between gap-2 text-sm">
                            <span>Corrigido. Lembre de reenviar o resumo pro motoboy.</span>
                            <button
                                type="button"
                                onClick={() => setAvisoCorrecao(false)}
                                className="shrink-0 text-yellow-200/70 hover:text-yellow-100"
                                aria-label="Fechar aviso"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {closing && divergente && !confirmado && (
                        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 p-3 text-sm flex items-start gap-2">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <span>
                                Os números mudaram depois do envio (era {closing.deliveriesCount}{" "}
                                {closing.deliveriesCount === 1 ? "corrida" : "corridas"} / {formatBRL(closing.feesTotal)} de
                                taxa / {formatBRL(closing.cashTotal)} em dinheiro). O motoboy ainda está vendo os valores
                                antigos — reenvie.
                            </span>
                        </div>
                    )}

                    {closing && divergente && confirmado && (
                        <div className="rounded-xl border border-red-600/50 bg-red-600/10 text-red-300 p-3 text-sm flex items-start gap-2">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <span>
                                O motoboy confirmou {formatBRL(Math.abs(closing.net))}, mas as corridas mudaram depois.
                                Reabra e reenvie.
                            </span>
                        </div>
                    )}

                    {confirmado ? (
                        <>
                            <p className="text-xs text-zinc-400">
                                O motoboy já confirmou este dia. Pra mudar alguma coisa, reabra primeiro.
                            </p>
                            <button
                                type="button"
                                onClick={reabrir}
                                disabled={pendente}
                                className="w-full min-h-11 flex items-center justify-center gap-2 bg-zinc-700 border border-zinc-600 text-white rounded-xl font-bold active:scale-[0.98] hover:bg-zinc-600 disabled:opacity-60"
                            >
                                {pendente ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                                Reabrir pra editar
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={enviar}
                            disabled={pendente || summary.deliveriesCount === 0}
                            className="w-full min-h-11 flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl font-bold active:scale-[0.98] hover:bg-green-500 disabled:opacity-50"
                        >
                            {pendente ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            {closing?.status === "sent" || closing?.status === "disputed"
                                ? (divergente ? "Reenviar com os valores atualizados" : "Reenviar pro motoboy confirmar")
                                : "Enviar pro motoboy confirmar"}
                        </button>
                    )}
                    <p className="text-xs text-zinc-500">
                        Enviar não mexe na carteira — os lançamentos de cada corrida já estão lá.
                        Isso aqui é só o “de acordo” dos dois lados.
                    </p>
                </div>
            )}
        </div>
    );
}

function FaixaStatus({ closing }: { closing: NonNullable<ClosingResumo> }) {
    if (closing.status === "draft") return null;
    const base = "rounded-xl border p-4 text-sm";
    if (closing.status === "sent") {
        return (
            <div className={`${base} border-yellow-500/40 bg-yellow-500/10 text-yellow-200`}>
                Enviado em {fmtDateTime(closing.sentAt)} — aguardando o motoboy confirmar.
            </div>
        );
    }
    if (closing.status === "confirmed") {
        return (
            <div className={`${base} border-green-600/50 bg-green-600/10 text-green-300 flex items-start gap-2`}>
                <Check size={18} className="shrink-0 mt-0.5" />
                <span>Confirmado pelo motoboy em {fmtDateTime(closing.respondedAt)}.</span>
            </div>
        );
    }
    return (
        <div className={`${base} border-red-600/50 bg-red-600/10 text-red-300 space-y-1`}>
            <div className="flex items-start gap-2 font-semibold">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>Contestado pelo motoboy em {fmtDateTime(closing.respondedAt)}</span>
            </div>
            {closing.motoboyNote && <p className="pl-6 text-red-200">“{closing.motoboyNote}”</p>}
        </div>
    );
}

function Total({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
    return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3">
            <div className="text-xs text-zinc-400">{label}</div>
            <div className={`font-mono font-bold ${cor ?? "text-white"}`}>{valor}</div>
        </div>
    );
}

function LinhaLeitura({
    linha,
    podeEditar,
    onEditar,
}: {
    linha: DailySummaryLine;
    podeEditar: boolean;
    onEditar: () => void;
}) {
    const recebeu = linha.receiptStatus === "recebido" || linha.receiptStatus === "valor_diferente";
    return (
        <div className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">
                    {/* "Corrida 7" na frente: é por esse número que a loja e o
                        motoboy se entendem sobre qual corrida é qual. */}
                    {rotuloCorrida(linha.dailySeq) && (
                        <span className="mr-1.5 px-1.5 py-0.5 text-[11px] font-bold rounded bg-green-600 text-white align-middle">
                            {rotuloCorrida(linha.dailySeq)}
                        </span>
                    )}
                    {linha.customerName || "Cliente"} · {linha.address.split(",")[0]}
                </div>
                <div className="text-xs text-zinc-500 truncate">
                    {fmtTime(linha.deliveredAt)}
                    {" · "}
                    {linha.receiptStatus ? RECEIPT_STATUS_LABEL[linha.receiptStatus] : "Sem recibo"}
                    {recebeu && linha.receivedMethod
                        ? ` ${formatBRL(linha.receivedAmount ?? 0)} em ${RECEIPT_METHOD_LABEL[linha.receivedMethod]}`
                        : ""}
                    {linha.adjustedAt ? " · corrigido pela loja" : ""}
                </div>
            </div>
            <div className="text-right shrink-0">
                <div className="font-mono font-bold text-green-400">{formatBRL(linha.fee)}</div>
                <div className="text-[11px] text-zinc-500">taxa</div>
            </div>
            {podeEditar && (
                <button
                    type="button"
                    onClick={onEditar}
                    className="min-h-11 min-w-11 flex items-center justify-center text-zinc-400 hover:text-green-400 rounded-lg hover:bg-zinc-700"
                    aria-label={`Corrigir ${rotuloCorrida(linha.dailySeq) ?? `corrida ${linha.id}`}`}
                >
                    <Pencil size={18} />
                </button>
            )}
        </div>
    );
}

const STATUS_OPCOES: { valor: "recebido" | "valor_diferente" | "nao_recebido" | "nada_a_receber"; label: string }[] = [
    { valor: "recebido", label: "Recebeu do cliente" },
    { valor: "valor_diferente", label: "Recebeu valor diferente" },
    { valor: "nao_recebido", label: "Não recebeu" },
    { valor: "nada_a_receber", label: "Já estava pago" },
];

function LinhaEdicao({
    linha,
    onCancelar,
    onSalvo,
}: {
    linha: DailySummaryLine;
    onCancelar: () => void;
    /** `fechamentoDesatualizado`: o dia já tinha um resumo enviado e ficou desatualizado com esta correção. */
    onSalvo: (fechamentoDesatualizado: boolean) => void;
}) {
    const [pendente, iniciar] = useTransition();
    const [erro, setErro] = useState<string | null>(null);
    const [fee, setFee] = useState(paraCampo(linha.fee));
    const [status, setStatus] = useState(linha.receiptStatus ?? "nada_a_receber");
    const [valor, setValor] = useState(paraCampo(linha.receivedAmount));
    const [metodo, setMetodo] = useState(linha.receivedMethod ?? "");

    const pediuValor = status === "recebido" || status === "valor_diferente";

    function salvar() {
        setErro(null);
        iniciar(async () => {
            const r = await adjustDeliveryReceiptAction({
                deliveryId: linha.id,
                fee,
                receiptStatus: status,
                receivedAmount: pediuValor ? valor : "0",
                receivedMethod: pediuValor ? (metodo as "dinheiro" | "pix" | "cartao") : "",
            });
            if ("error" in r) { setErro(r.error); return; }
            onSalvo(r.fechamentoDesatualizado === true);
        });
    }

    return (
        <div className="p-3 bg-zinc-900/60 space-y-3">
            <div className="text-sm font-semibold text-white truncate">
                {linha.customerName || "Cliente"} · {linha.address.split(",")[0]}
            </div>

            <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-400">
                    Taxa da corrida
                    <input
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        inputMode="decimal"
                        className="mt-1 w-full p-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </label>
                <label className="text-xs text-zinc-400">
                    O que aconteceu
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as typeof status)}
                        className="mt-1 w-full p-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                            className="mt-1 w-full p-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </label>
                    <label className="text-xs text-zinc-400">
                        Como pagou
                        <select
                            value={metodo}
                            onChange={(e) => setMetodo(e.target.value as typeof metodo)}
                            className="mt-1 w-full p-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                Só dinheiro em espécie entra na conta do que ele tem pra devolver. PIX e cartão caem direto na loja.
            </p>

            {erro && (
                <div className="bg-red-900/30 border border-red-700/50 text-red-300 p-2 rounded-lg text-xs">{erro}</div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={onCancelar}
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
