"use client";

import { useActionState, useState } from "react";
import { createRouteAction } from "../../actions/route";
import { Plus, Trash, MapPin, User, DollarSign, ArrowLeft, Loader2, Package } from "lucide-react";
import Link from "next/link";

const initialState = {
    message: "",
    error: ""
};

export default function NewRoutePage() {
    const [items, setItems] = useState([{ id: 1 }]);
    const [state, formAction, isPending] = useActionState(createRouteAction, initialState);

    const addItem = () => {
        setItems([...items, { id: Date.now() }]);
    };

    const removeItem = (id: number) => {
        if (items.length === 1) return;
        setItems(items.filter(i => i.id !== id));
    };

    return (
        <div className="min-h-screen bg-zinc-900 pb-20 md:pb-8">
            <header className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-md">
                <Link href="/" className="p-2 text-zinc-400 hover:text-green-400 rounded-full hover:bg-zinc-700 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex items-center gap-2">
                    <Package size={20} className="text-green-400" />
                    <h1 className="text-xl font-bold text-white">Nova Rota de Entrega</h1>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-6">
                <form action={formAction} className="space-y-6">
                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <div key={item.id} className="bg-zinc-800 p-6 rounded-xl shadow-sm border border-zinc-700 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold text-white flex items-center gap-2">
                                        <span className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-sm">{index + 1}</span>
                                        Entrega
                                    </h3>
                                    {items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(item.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                                            <Trash size={18} />
                                        </button>
                                    )}
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Cliente</label>
                                        <div className="relative">
                                            <User size={18} className="absolute left-3 top-3 text-zinc-500" />
                                            <input
                                                name="name"
                                                placeholder="Nome do Cliente"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Valor (R$)</label>
                                        <div className="relative">
                                            <DollarSign size={18} className="absolute left-3 top-3 text-zinc-500" />
                                            <input
                                                name="value"
                                                type="number"
                                                step="0.01"
                                                placeholder="0,00"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 relative">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Telefone do Cliente (Opcional)</label>
                                        <div className="relative">
                                            <input
                                                name="customerPhone"
                                                placeholder="21999999999"
                                                className="w-full px-4 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 relative">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Observação (Opcional)</label>
                                        <div className="relative">
                                            <input
                                                name="observation"
                                                placeholder="Ex: Interfone quebrado, deixar na portaria..."
                                                className="w-full px-4 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 relative">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Endereço Completo</label>
                                        <div className="relative">
                                            <MapPin size={18} className="absolute left-3 top-3 text-zinc-500" />
                                            <input
                                                name="address"
                                                placeholder="Rua Exemplo, 123 - Bairro"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 outline-none transition-all"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {state?.error && (
                        <div className="bg-red-900/50 text-red-400 p-4 rounded-xl border border-red-700 text-center">
                            {state.error}
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-4">
                        <button type="button" onClick={addItem} className="flex-1 py-4 border-2 border-dashed border-zinc-600 rounded-xl text-zinc-400 font-semibold hover:border-green-500 hover:text-green-400 hover:bg-green-900/20 transition-all flex items-center justify-center gap-2">
                            <Plus size={20} />
                            Adicionar Entrega
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-500 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 size={24} className="animate-spin" />
                                    Criando Rota...
                                </>
                            ) : (
                                "Finalizar e Criar Rota"
                            )}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
