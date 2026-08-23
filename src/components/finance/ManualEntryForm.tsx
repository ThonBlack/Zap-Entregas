"use client";

import { useActionState, useState } from "react";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { createTransactionAction, type ManualEntryState } from "@/app/actions/finance";
import { MANUAL_ENTRY_OPTIONS, type ManualEntryKey, formatBRL } from "@/lib/wallet-shared";

type Motoboy = { id: number; name: string; phone: string; balance?: number };

type Props = {
    motoboys: Motoboy[];
    defaultMotoboyId?: number;
    defaultEntry?: ManualEntryKey;
    defaultAmount?: number;
    returnTo: string;
};

const ORDER: ManualEntryKey[] = ["paguei", "recebi", "bonus", "desconto", "abertura_devo", "abertura_deve"];

export default function ManualEntryForm({ motoboys, defaultMotoboyId, defaultEntry = "paguei", defaultAmount, returnTo }: Props) {
    const [state, formAction, pending] = useActionState<ManualEntryState, FormData>(createTransactionAction, null);
    const [entry, setEntry] = useState<ManualEntryKey>(defaultEntry);
    const [motoboyId, setMotoboyId] = useState<number>(defaultMotoboyId ?? motoboys[0]?.id ?? 0);
    const selected = motoboys.find(m => m.id === motoboyId);

    return (
        <form action={formAction} className="space-y-6">
            <input type="hidden" name="returnTo" value={returnTo} />

            <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Motoboy</label>
                <select
                    name="motoboyId"
                    value={motoboyId}
                    onChange={e => setMotoboyId(Number(e.target.value))}
                    className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                >
                    <option value="">Escolha um motoboy...</option>
                    {motoboys.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>
                    ))}
                </select>
                {selected?.balance != null && (
                    <p className="text-sm mt-2 text-zinc-600">
                        Saldo atual:{" "}
                        <strong className={selected.balance > 0 ? "text-green-700" : selected.balance < 0 ? "text-red-700" : "text-zinc-700"}>
                            {formatBRL(Math.abs(selected.balance))}
                        </strong>{" "}
                        {selected.balance > 0 ? "— você deve a ele" : selected.balance < 0 ? "— ele deve a você" : "— zerado"}
                    </p>
                )}
            </div>

            <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">O que aconteceu?</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ORDER.map(key => {
                        const opt = MANUAL_ENTRY_OPTIONS[key];
                        const isCredit = opt.type === "credit";
                        return (
                            <label key={key} className="cursor-pointer">
                                <input
                                    type="radio"
                                    name="entry"
                                    value={key}
                                    checked={entry === key}
                                    onChange={() => setEntry(key)}
                                    className="peer sr-only"
                                />
                                <div className={`p-3 rounded-xl border-2 border-zinc-100 hover:bg-zinc-50 transition-all h-full
                                    ${isCredit ? "peer-checked:border-green-500 peer-checked:bg-green-50" : "peer-checked:border-red-500 peer-checked:bg-red-50"}`}>
                                    <div className={`font-bold text-sm ${isCredit ? "text-green-700" : "text-red-700"}`}>{opt.label}</div>
                                    <div className="text-xs text-zinc-500 mt-1">{opt.hint}</div>
                                </div>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Valor (R$)</label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R$</span>
                    <input
                        type="number"
                        name="amount"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        defaultValue={defaultAmount && defaultAmount > 0 ? defaultAmount.toFixed(2) : ""}
                        className="w-full p-4 pl-12 bg-zinc-50 border border-zinc-200 rounded-xl font-mono text-xl font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0,00"
                        required
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Descrição (opcional)</label>
                <input
                    type="text"
                    name="description"
                    maxLength={140}
                    className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: acerto da semana, PIX de sábado..."
                />
            </div>

            <label className="flex items-start gap-3 text-sm text-zinc-700 cursor-pointer">
                <input type="checkbox" name="needsConfirmation" className="mt-1 w-4 h-4 accent-green-600" />
                <span>
                    Pedir confirmação do motoboy
                    <span className="block text-xs text-zinc-500">Se marcar, o lançamento só entra no saldo depois que ele aceitar no app dele.</span>
                </span>
            </label>

            {state?.error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    <AlertCircle size={18} /> {state.error}
                </div>
            )}

            <button
                type="submit"
                disabled={pending}
                className="w-full bg-zinc-900 text-white font-bold py-4 rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 text-lg shadow-lg shadow-zinc-900/10 active:scale-95 transform disabled:opacity-60"
            >
                {pending ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle size={24} />}
                {pending ? "Salvando..." : "Salvar lançamento"}
            </button>
        </form>
    );
}
