import { getFinancialRecordsAction, deleteFinancialRecordAction, markAsPaidAction } from "@/app/actions/financial-records";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, CheckCircle, AlertCircle, DollarSign } from "lucide-react";

export default async function FinanceManagerPage(props: { searchParams: Promise<{ month?: string, year?: string }> }) {
    const searchParams = await props.searchParams;
    const month = searchParams.month ? parseInt(searchParams.month) : new Date().getMonth() + 1;
    const year = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();

    const { records, error } = await getFinancialRecordsAction(month, year);

    if (error) {
        return <div className="p-6 text-red-500">{error}</div>;
    }

    const safeRecords = records || [];

    const totalIncome = safeRecords.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
    const totalExpense = safeRecords.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
    const balance = totalIncome - totalExpense;

    return (
        <div className="min-h-screen bg-gray-50 p-6 space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800">Gestor Financeiro</h1>
                </div>
                <Link href="/finance/manager/new" className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition-colors">
                    <Plus className="w-4 h-4" />
                    Novo Lançamento
                </Link>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-green-600 rotate-90" />
                        </div>
                        <span className="text-gray-500 font-medium">Receitas</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                        {totalIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-red-600 -rotate-90" />
                        </div>
                        <span className="text-gray-500 font-medium">Despesas</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                        {totalExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <DollarSign className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-gray-500 font-medium">Saldo (Mês)</span>
                    </div>
                    <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            </div>

            {/* Filters (Simple link based for now) */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <Link
                        key={m}
                        href={`/finance/manager?month=${m}&year=${year}`}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${m === month ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                    >
                        {new Date(0, m - 1).toLocaleString('pt-BR', { month: 'long' })}
                    </Link>
                ))}
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 font-semibold text-gray-700">
                    Extrato de {new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                </div>

                {safeRecords.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Nenhum registro encontrado para este mês.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {safeRecords.map(record => (
                            <div key={record.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-12 rounded-full ${record.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <div>
                                        <p className="font-medium text-gray-800">{record.description}</p>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <span>{new Date(record.dueDate).toLocaleDateString('pt-BR')}</span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <span>{record.category}</span>
                                            {record.status === 'paid' && (
                                                <span className="flex items-center text-green-600 text-xs bg-green-50 px-2 py-0.5 rounded-full">
                                                    <CheckCircle className="w-3 h-3 mr-1" /> Pago
                                                </span>
                                            )}
                                            {record.status === 'overdue' && (
                                                <span className="flex items-center text-red-600 text-xs bg-red-50 px-2 py-0.5 rounded-full">
                                                    <AlertCircle className="w-3 h-3 mr-1" /> Vencido
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`font-bold ${record.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {record.type === 'expense' ? '-' : '+'}
                                        {record.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>

                                    <div className="flex gap-2">
                                        {record.status === 'pending' && (
                                            <form action={async () => {
                                                "use server";
                                                await markAsPaidAction(record.id);
                                            }}>
                                                <button className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">
                                                    Marcar Pago
                                                </button>
                                            </form>
                                        )}
                                        <form action={async () => {
                                            "use server";
                                            await deleteFinancialRecordAction(record.id);
                                        }}>
                                            <button className="p-1 text-gray-400 hover:text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </form>

                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
