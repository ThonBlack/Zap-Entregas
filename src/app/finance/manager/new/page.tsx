import { createFinancialRecordAction } from "@/app/actions/financial-records";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

export default function NewFinancialRecordPage() {

    async function handleSubmit(formData: FormData) {
        "use server";
        await createFinancialRecordAction(formData);
        redirect("/finance/manager");
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
            <div className="w-full max-w-lg">
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/finance/manager" className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800">Novo Lançamento</h1>
                </div>

                <form action={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">

                    {/* Tipo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Movimentação</label>
                        <div className="flex gap-4">
                            <label className="flex-1 cursor-pointer">
                                <input type="radio" name="type" value="income" className="peer sr-only" />
                                <div className="p-3 text-center border rounded-lg peer-checked:bg-green-50 peer-checked:border-green-500 peer-checked:text-green-700 hover:bg-gray-50">
                                    Receita
                                </div>
                            </label>
                            <label className="flex-1 cursor-pointer">
                                <input type="radio" name="type" value="expense" className="peer sr-only" defaultChecked />
                                <div className="p-3 text-center border rounded-lg peer-checked:bg-red-50 peer-checked:border-red-500 peer-checked:text-red-700 hover:bg-gray-50">
                                    Despesa
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                        <input type="text" name="description" required placeholder="Ex: Aluguel, Conta de Luz" className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>

                    {/* Categoria */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                        <select name="category" className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            <option value="Operacional">Operacional</option>
                            <option value="Pessoal">Pessoal</option>
                            <option value="Impostos">Impostos</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Outros">Outros</option>
                        </select>
                    </div>

                    {/* Valor */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                        <input type="number" name="amount" step="0.01" required placeholder="0,00" className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>

                    {/* Data de Vencimento */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data de Vencimento</label>
                        <input type="date" name="dueDate" required className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status Inicial</label>
                        <select name="status" className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            <option value="pending">Pendente</option>
                            <option value="paid">Pago</option>
                        </select>
                    </div>

                    <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors mt-4">
                        Salvar Lançamento
                    </button>
                </form>
            </div>
        </div>
    );
}
