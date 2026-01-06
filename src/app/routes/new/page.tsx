"use client";

import { useState } from "react";
import { createRouteAction } from "../../actions/route";
import { Plus, Trash, MapPin, User, DollarSign, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewRoutePage() {
    const [items, setItems] = useState([{ id: 1 }]);

    const addItem = () => {
        setItems([...items, { id: Date.now() }]);
    };

    const removeItem = (id: number) => {
        if (items.length === 1) return;
        setItems(items.filter(i => i.id !== id));
    };

    return (
        <div className="min-h-screen bg-zinc-50 p-6">
            <div className="max-w-3xl mx-auto">
                <header className="mb-6 flex items-center gap-4">
                    <Link href="/" className="p-2 bg-white rounded-full shadow-sm hover:shadow-md transition-all">
                        <ArrowLeft size={20} className="text-zinc-600" />
                    </Link>
                    <h1 className="text-2xl font-bold text-zinc-900">Nova Rota de Entrega</h1>
                </header>

                <form action={createRouteAction} className="space-y-6">
                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <div key={item.id} className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold text-zinc-700">Entrega #{index + 1}</h3>
                                    {items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">
                                            <Trash size={18} />
                                        </button>
                                    )}
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Cliente</label>
                                        <div className="relative">
                                            <User size={18} className="absolute left-3 top-3 text-zinc-400" />
                                            <input
                                                name="name"
                                                placeholder="Nome do Cliente"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Valor (R$)</label>
                                        <div className="relative">
                                            <DollarSign size={18} className="absolute left-3 top-3 text-zinc-400" />
                                            <input
                                                name="value"
                                                type="number"
                                                step="0.01"
                                                placeholder="0,00"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 relative">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Telefone do Cliente (Opcional)</label>
                                        <div className="relative">
                                            <input
                                                name="customerPhone"
                                                placeholder="21999999999"
                                                className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 relative">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Observação (Opcional)</label>
                                        <div className="relative">
                                            <input
                                                name="observation"
                                                placeholder="Ex: Interfone quebrado, deixar na portaria..."
                                                className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 relative">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Endereço Completo</label>
                                        <div className="relative">
                                            <MapPin size={18} className="absolute left-3 top-3 text-zinc-400" />
                                            <input
                                                name="address"
                                                placeholder="Rua Exemplo, 123 - Bairro"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <button type="button" onClick={addItem} className="flex-1 py-4 border-2 border-dashed border-zinc-300 rounded-xl text-zinc-500 font-semibold hover:border-green-500 hover:text-green-600 hover:bg-green-50 transition-all flex items-center justify-center gap-2">
                            <Plus size={20} />
                            Adicionar Entrega
                        </button>
                        <button type="submit" className="flex-1 py-4 bg-green-600 text-white rounded-xl font-bold shadow-green-900/20 shadow-lg hover:bg-green-500 active:scale-[0.98] transition-all">
                            Finalizar e Criar Rota
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
