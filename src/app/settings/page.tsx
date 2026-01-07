"use client";

import { updateSettingsAction } from "@/app/actions/settings";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeft, CheckCircle, Save, HelpCircle } from "lucide-react";

const initialState = {
    message: "",
    success: false
};

export default function SettingsPage() {
    const [state, formAction, isPending] = useActionState(updateSettingsAction, initialState);
    const [model, setModel] = useState("fixed");

    // In a real app we'd fetch initial data, but for now we rely on user inputting it or defaults
    // If we wanted to load data, we'd need to fetch it in a Server Component wrapper and pass as props

    return (
        <div className="min-h-screen bg-zinc-50 pb-20 md:pb-8">
            <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
                <Link href="/" className="p-2 -ml-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-bold text-zinc-900">Configurações da Loja</h1>
            </header>

            <main className="max-w-2xl mx-auto p-6">
                <form action={formAction} className="space-y-8">

                    {/* Remuneration Model Section */}
                    <section className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Save size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-zinc-900">Modelo de Pagamento</h2>
                                <p className="text-sm text-zinc-500">Como você paga seus entregadores?</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div
                                onClick={() => setModel("fixed")}
                                className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${model === "fixed" ? "border-blue-500 bg-blue-50" : "border-zinc-200 hover:border-zinc-300"}`}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-zinc-900">Taxa Fixa</span>
                                    {model === "fixed" && <CheckCircle size={16} className="text-blue-500" />}
                                </div>
                                <p className="text-xs text-zinc-500">Valor único por entrega realizada.</p>
                            </div>

                            <div
                                onClick={() => setModel("distance")}
                                className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${model === "distance" ? "border-blue-500 bg-blue-50" : "border-zinc-200 hover:border-zinc-300"}`}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-zinc-900">Por KM</span>
                                    {model === "distance" && <CheckCircle size={16} className="text-blue-500" />}
                                </div>
                                <p className="text-xs text-zinc-500">Calculado pela distância da rota.</p>
                            </div>

                            <div
                                onClick={() => setModel("hybrid")}
                                className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${model === "hybrid" ? "border-blue-500 bg-blue-50" : "border-zinc-200 hover:border-zinc-300"}`}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-zinc-900">Fixo + KM</span>
                                    {model === "hybrid" && <CheckCircle size={16} className="text-blue-500" />}
                                </div>
                                <p className="text-xs text-zinc-500">Taxa de saída + valor por Km rodado.</p>
                            </div>

                            <div
                                onClick={() => setModel("daily")}
                                className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${model === "daily" ? "border-blue-500 bg-blue-50" : "border-zinc-200 hover:border-zinc-300"}`}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-zinc-900">Diária</span>
                                    {model === "daily" && <CheckCircle size={16} className="text-blue-500" />}
                                </div>
                                <p className="text-xs text-zinc-500">Valor fixo por dia de trabalho.</p>
                            </div>
                        </div>

                        <input type="hidden" name="remunerationModel" value={model} />

                        <div className="space-y-4">
                            {(model === "fixed" || model === "hybrid") && (
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                                        Taxa Fixa (por entrega)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-zinc-400">R$</span>
                                        <input
                                            name="fixedValue"
                                            type="text"
                                            placeholder="5,00"
                                            className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {(model === "distance" || model === "hybrid") && (
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                                        Valor por KM
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-zinc-400">R$</span>
                                        <input
                                            name="valuePerKm"
                                            type="text"
                                            placeholder="1,50"
                                            className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {model === "daily" && (
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                                        Valor da Diária
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-zinc-400">R$</span>
                                        <input
                                            name="dailyValue"
                                            type="text"
                                            placeholder="50,00"
                                            className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-zinc-100">
                                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 mb-1">
                                    Mínimo Garantido (Opcional)
                                    <div title="Se o motoboy não atingir esse valor no dia, você completa." className="text-zinc-400 cursor-help">
                                        <HelpCircle size={14} />
                                    </div>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-zinc-400">R$</span>
                                    <input
                                        name="guaranteedMinimum"
                                        type="text"
                                        placeholder="0,00"
                                        className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <p className="text-xs text-zinc-500 mt-1">Valor mínimo que o motoboy recebe no dia, independente das entregas.</p>
                            </div>
                        </div>
                    </section>

                    {state?.message && (
                        <div className={`p-4 rounded-xl text-center font-medium ${state.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {state.message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/10 transition-all flex justify-center items-center gap-2"
                    >
                        {isPending ? "Salvando..." : (
                            <>
                                <Save size={20} />
                                Salvar Configurações
                            </>
                        )}
                    </button>
                </form>
            </main>
        </div>
    );
}
