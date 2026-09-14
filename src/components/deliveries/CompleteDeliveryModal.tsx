"use client";

import { X, CheckCircle2, Banknote, QrCode, CreditCard } from "lucide-react";
import { useState } from "react";
import { AVISO_VALOR_VAZIO, AVISO_CONFERIR_SEM_METODO, type DeliveryReceipt } from "@/lib/receipt";
import { parseMoney } from "@/lib/money";
import type { ChargeMode } from "@/lib/chargeMode";

interface CompleteDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (receipt: DeliveryReceipt) => void;
    orderValue: number | null; // valor do pedido (pode estar oculto pro motoboy)
    /**
     * Tipo de cobrança da corrida. Muda as opções inteiras: "a conferir" é o
     * PIX da loja (que NÃO passa pela mão do motoboy), "a receber" é o dinheiro
     * que ele cobra na porta, "pago" não tem o que receber.
     */
    chargeMode?: ChargeMode;
    /** Quem está finalizando é a LOJA, não o motoboy: o texto fala dele na 3ª pessoa. */
    porLoja?: boolean;
    loading?: boolean;
}

const METHODS = [
    { key: "dinheiro" as const, label: "Dinheiro", Icon: Banknote },
    { key: "pix" as const, label: "PIX", Icon: QrCode },
    { key: "cartao" as const, label: "Cartão", Icon: CreditCard },
];

/** Dinheiro na tela é sempre "150,50" — nunca "150.5". */
const reais = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

/**
 * Uma opção do "o que aconteceu com o pagamento?".
 *
 * A chave é da TELA, não do banco: em "a conferir" duas opções diferentes
 * ("o Pix da loja caiu" e "me pagou em dinheiro") gravam o mesmo
 * `receiptStatus: "recebido"` e mudam só o método — e é justamente o método
 * que decide se entra ou não débito na carteira do motoboy.
 */
type Opcao = {
    key: string;
    label: string;
    status: DeliveryReceipt["status"];
    /** Método já decidido pela própria opção (não pergunta de novo). */
    method?: DeliveryReceipt["method"];
    /** Usa o valor do pedido como o valor recebido. */
    valorDoPedido?: boolean;
    /** Abre o campo "quanto recebeu". */
    pedeValor?: boolean;
    /** Abre a escolha dinheiro/PIX/cartão. */
    pedeMetodo?: boolean;
};

function montarOpcoes(modo: ChargeMode, orderValue: number | null, porLoja: boolean): Opcao[] {
    const temValor = orderValue != null && orderValue > 0;
    const quanto = temValor ? ` (${reais(orderValue!)})` : "";

    if (modo === "conferir") {
        return [
            {
                key: "pix_da_loja",
                label: `✅ Pix confirmado (a loja recebeu${temValor ? ` ${reais(orderValue!)}` : ""})`,
                status: "recebido",
                method: "pix",
                valorDoPedido: true,
            },
            {
                key: "dinheiro_na_porta",
                label: porLoja
                    ? `💵 Pagou em dinheiro pro motoboy${quanto}`
                    : `💵 Pagou em dinheiro pra mim${quanto}`,
                status: "recebido",
                method: "dinheiro",
                valorDoPedido: true,
            },
            {
                key: "outro_valor",
                label: porLoja ? "✏️ Recebeu outro valor" : "✏️ Recebi outro valor",
                status: "valor_diferente",
                pedeValor: true,
                pedeMetodo: true,
            },
            { key: "nao_pagou", label: "🚫 Não pagou", status: "nao_recebido" },
        ];
    }

    if (modo === "pago") {
        return [
            { key: "nada", label: "✅ Nada a receber (o pedido já estava pago)", status: "nada_a_receber" },
            {
                key: "mesmo_assim",
                label: porLoja
                    ? "✏️ Recebeu mesmo assim (informar valor)"
                    : "✏️ Recebi mesmo assim (informar valor)",
                status: "valor_diferente",
                pedeValor: true,
                pedeMetodo: true,
            },
        ];
    }

    // "a receber": as mesmas opções de sempre.
    return [
        ...(temValor
            ? [{
                key: "recebido",
                label: porLoja
                    ? `✅ Recebeu o valor (${reais(orderValue!)})`
                    : `✅ Recebi o valor (${reais(orderValue!)})`,
                status: "recebido" as const,
                valorDoPedido: true,
                pedeMetodo: true,
            }]
            : []),
        {
            key: "valor_diferente",
            label: temValor
                ? (porLoja ? "✏️ Recebeu outro valor" : "✏️ Recebi outro valor")
                : (porLoja ? "✏️ Recebeu (informar valor)" : "✏️ Recebi (informar valor)"),
            status: "valor_diferente",
            pedeValor: true,
            pedeMetodo: true,
        },
        { key: "nao_recebido", label: porLoja ? "🚫 Não recebeu" : "🚫 Não recebi", status: "nao_recebido" },
        { key: "nada_a_receber", label: "💳 Nada a receber (já estava pago)", status: "nada_a_receber" },
    ];
}

export default function CompleteDeliveryModal({
    isOpen, onClose, onConfirm, orderValue, chargeMode = "receber", porLoja = false, loading,
}: CompleteDeliveryModalProps) {
    const opcoes = montarOpcoes(chargeMode, orderValue, porLoja);
    const [escolha, setEscolha] = useState<string>(opcoes[0].key);
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState<DeliveryReceipt["method"]>(undefined);
    const [note, setNote] = useState("");
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const opcao = opcoes.find(o => o.key === escolha) ?? opcoes[0];

    const handleConfirm = () => {
        setError("");
        const receipt: DeliveryReceipt = { status: opcao.status, note: note.trim() || undefined };

        if (opcao.valorDoPedido) {
            receipt.amount = orderValue ?? 0;
        } else if (opcao.pedeValor) {
            // Campo em branco dava Number("") === 0 e passava: a corrida era
            // finalizada com R$ 0,00 e o dinheiro no bolso do motoboy sumia da conta.
            const amt = parseMoney(amount);
            if (amt === null || amt <= 0) {
                setError(AVISO_VALOR_VAZIO);
                return;
            }
            receipt.amount = amt;
        }

        if (opcao.method) {
            receipt.method = opcao.method;
        } else if (opcao.pedeMetodo) {
            if (!method) {
                setError(chargeMode === "conferir" ? AVISO_CONFERIR_SEM_METODO : "Escolha como recebeu: dinheiro, PIX ou cartão.");
                return;
            }
            receipt.method = method;
        }

        onConfirm(receipt);
    };

    const pergunta = chargeMode === "conferir"
        ? (porLoja ? "O cliente pagou o Pix da loja?" : "O Pix da loja caiu?")
        : chargeMode === "pago"
            ? "Esse pedido já estava pago. Confirma?"
            : (porLoja ? "O motoboy recebeu do cliente?" : "Recebeu do cliente?");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-full"><CheckCircle2 className="w-6 h-6 text-green-600" /></div>
                        <h3 className="text-xl font-bold text-gray-900">
                            {porLoja ? "Marcar como entregue" : "Finalizar Entrega"}
                        </h3>
                    </div>
                    <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {chargeMode === "conferir" && (
                    <p className="text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 mb-3">
                        Esse cliente paga no <strong>Pix da loja</strong>. Pix confirmado não passa pela mão do
                        motoboy e não entra na conta dele — dinheiro na mão, sim.
                    </p>
                )}

                <p className="text-sm font-medium text-gray-700 mb-2">{pergunta}</p>
                <div className="space-y-2 mb-4">
                    {opcoes.map(opt => (
                        <label key={opt.key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${escolha === opt.key ? "border-green-500 bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}>
                            <input
                                type="radio"
                                name="receiptStatus"
                                checked={escolha === opt.key}
                                onChange={() => { setEscolha(opt.key); setError(""); }}
                                className="w-4 h-4 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-800">{opt.label}</span>
                        </label>
                    ))}
                </div>

                {opcao.pedeValor && (
                    <div className="mb-4">
                        <label htmlFor="valor-recebido" className="block text-sm font-medium text-gray-700 mb-1">
                            Valor recebido (R$)
                        </label>
                        <input
                            id="valor-recebido"
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0,00"
                            className="w-full px-4 py-2 bg-white text-zinc-900 placeholder-zinc-400 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        />
                    </div>
                )}

                {opcao.pedeMetodo && (
                    <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Como recebeu?</p>
                        <div className="grid grid-cols-3 gap-2">
                            {METHODS.map(({ key, label, Icon }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => { setMethod(key); setError(""); }}
                                    className={`flex flex-col items-center gap-1 p-3 min-h-11 rounded-lg border text-sm font-medium transition-colors ${method === key ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                                >
                                    <Icon size={20} />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mb-4">
                    <label htmlFor="obs-entrega" className="block text-sm font-medium text-gray-700 mb-1">
                        Observação (opcional)
                    </label>
                    <textarea
                        id="obs-entrega"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder="Ex.: cliente pediu troco, portão azul..."
                        className="w-full px-4 py-2 bg-white text-zinc-900 placeholder-zinc-400 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
                    />
                </div>

                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

                <p className="text-xs text-gray-400 mb-4">
                    Ao confirmar, o motoboy deixa de ver endereço, telefone e observação
                    desta entrega no histórico dele (LGPD). A loja continua vendo tudo.
                </p>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="min-h-11 px-4 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="min-h-11 px-4 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white transition-all disabled:opacity-50"
                    >
                        {loading ? "Salvando..." : porLoja ? "Marcar entregue" : "Confirmar Entrega"}
                    </button>
                </div>
            </div>
        </div>
    );
}
