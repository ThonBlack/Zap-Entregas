import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle, DollarSign } from "lucide-react";
import { createTransactionAction } from "@/app/actions/finance";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function NewTransactionPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) redirect("/login");

    // Fetch motoboys for dropdown
    const motoboys = await db.select().from(users).where(eq(users.role, 'motoboy'));

    return (
        <div className="min-h-screen bg-zinc-50 pb-20">
            <header className="bg-white border-b border-zinc-200 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-sm">
                <Link href="/" className="text-zinc-500 hover:text-zinc-900">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-bold text-zinc-900">Lançar Pagamento</h1>
            </header>

            <main className="max-w-xl mx-auto p-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
                    <form action={createTransactionAction} className="space-y-6">

                        {/* 1. Select Motoboy */}
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Selecione o Motoboy</label>
                            <div className="grid grid-cols-1 gap-2">
                                <select name="motoboyId" className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none" required>
                                    <option value="">Escolha um motoboy...</option>
                                    {motoboys.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 2. Transaction Type */}
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Tipo de Movimentação</label>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="cursor-pointer">
                                    <input type="radio" name="type" value="credit" className="peer sr-only" required />
                                    <div className="p-4 rounded-xl border-2 border-zinc-100 peer-checked:border-green-500 peer-checked:bg-green-50 hover:bg-zinc-50 transition-all text-center">
                                        <div className="font-bold text-green-700 mb-1">Pagar Motoboy</div>
                                        <div className="text-xs text-zinc-500">Sai do meu caixa / Abate dívida dele</div>
                                    </div>
                                </label>
                                <label className="cursor-pointer">
                                    <input type="radio" name="type" value="debit" className="peer sr-only" required />
                                    <div className="p-4 rounded-xl border-2 border-zinc-100 peer-checked:border-red-500 peer-checked:bg-red-50 hover:bg-zinc-50 transition-all text-center">
                                        <div className="font-bold text-red-700 mb-1">Receber Valor</div>
                                        <div className="text-xs text-zinc-500">Entra no meu caixa / Motoboy me pagou</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* 3. Amount */}
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Valor (R$)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R$</span>
                                <input
                                    type="number"
                                    name="amount"
                                    step="0.01"
                                    className="w-full p-4 pl-12 bg-zinc-50 border border-zinc-200 rounded-xl font-mono text-xl font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="0,00"
                                    required
                                />
                            </div>
                        </div>

                        {/* 4. Description */}
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Descrição (Opcional)</label>
                            <input
                                type="text"
                                name="description"
                                className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Ex: Gasolina, Acerto semanal..."
                            />
                        </div>

                        <button type="submit" className="w-full bg-zinc-900 text-white font-bold py-4 rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 text-lg shadow-lg shadow-zinc-900/10 active:scale-95 transform">
                            <CheckCircle size={24} />
                            Confirmar Lançamento
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
