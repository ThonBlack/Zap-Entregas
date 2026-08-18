"use client";

import { X, CheckCircle2, Banknote, QrCode, CreditCard } from "lucide-react";
import { useState } from "react";
import type { DeliveryReceipt } from "@/app/actions/logistics";

interface CompleteDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (receipt: DeliveryReceipt) => void;
    orderValue: number | null; // valor do pedido (pode estar oculto pro motoboy)
    loading?: boolean;
}

const METHODS = [
    { key: "dinheiro" as const, label: "Dinheiro", Icon: Banknote },
    { key: "pix" as const, label: "PIX", Icon: QrCode },
    { key: "cartao" as const, label: "Cartão", Icon: CreditCard },
];

export default function CompleteDeliveryModal({ isOpen, onClose, onConfirm, orderValue, loading }: CompleteDeliveryModalProps) {
    const hasValue = orderValue != null && orderValue > 0;
    const [status, setStatus] = useState<DeliveryReceipt["status"]>(hasValue ? "recebido" : "valor_diferente");
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState<DeliveryReceipt["method"]>(undefined);
    const [note, setNote] = useState("");
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const needsAmountInput = status === "valor_diferente";
    const needsMethod = status === "recebido" || status === "valor_diferente";

    const handleConfirm = () => {
        setError("");
        const receipt: DeliveryReceipt = { status, note: note.trim() || undefined };
        if (status === "recebido") {
            receipt.amount = orderValue ?? 0;
        } else if (status === "valor_diferente") {
            const amt = Number(amount.replace(",", "."));
            if (!Number.isFinite(amt) || amt < 0) {
                setError("Informe o valor recebido.");
                return;
            }
            receipt.amount = amt;
        }
        if (needsMethod) {
            if (!method) {
                setError("Escolha como recebeu: dinheiro, PIX ou cartão.");
                return;
            }
            receipt.method = method;
        }
        onConfirm(receipt);
    };

    const options: { key: DeliveryReceipt["status"]; label: string }[] = [
        ...(hasValue ? [{ key: "recebido" as const, label: `✅ Recebi o valor (R$ ${orderValue!.toFixed(2).replace(".", ",")})` }] : []),
        { key: "valor_diferente", label: hasValue ? "✏️ Recebi outro valor" : "✏️ Recebi (informar valor)" },
        { key: "nao_recebido", label: "🚫 Não recebi" },
        { key: "nada_a_receber", label: "💳 Nada a receber (já estava pago)" },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-full"><CheckCircle2 className="w-6 h-6 text-green-600" /></div>
                        <h3 className="text-xl font-bold text-gray-900">Finalizar Entrega</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <p className="text-sm font-medium text-gray-700 mb-2">Recebeu do cliente?</p>
                <div className="space-y-2 mb-4">
                    {options.map(opt => (
                        <label key={opt.key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${status === opt.key ? "border-green-500 bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}>
                            <input
                                type="radio"
                                name="receiptStatus"
                                checked={status === opt.key}
                                onChange={() => { setStatus(opt.key); setError(""); }}
                                className="w-4 h-4 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-800">{opt.label}</span>
                        </label>
                    ))}
                </div>

                {needsAmountInput && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor recebido (R$)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0,00"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        />
                    </div>
                )}

                {needsMethod && (
                    <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Como recebeu?</p>
                        <div className="grid grid-cols-3 gap-2">
                            {METHODS.map(({ key, label, Icon }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => { setMethod(key); setError(""); }}
                                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm font-medium transition-colors ${method === key ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                                >
                                    <Icon size={20} />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder="Ex.: cliente pediu troco, portão azul..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
                    />
                </div>

                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

                <p className="text-xs text-gray-400 mb-4">
                    Ao confirmar, os dados de contato do cliente ficam ocultos (LGPD).
                </p>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white transition-all disabled:opacity-50"
                    >
                        {loading ? "Salvando..." : "Confirmar Entrega"}
                    </button>
                </div>
            </div>
        </div>
    );
}
