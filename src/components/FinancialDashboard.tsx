"use client";

import { useState, useTransition, useEffect } from "react";
import { getFinancialStatsAction } from "@/app/actions/finance";
import DailyChart from "./DailyChart";
import { ChevronLeft, ChevronRight, Loader2, TrendingDown, TrendingUp } from "lucide-react";

export default function FinancialDashboard() {
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [isPending, startTransition] = useTransition();

    const [stats, setStats] = useState<{
        data: { day: number; value: number }[];
        total: number;
        role: string;
    } | null>(null);

    const fetchData = () => {
        startTransition(async () => {
            const result = await getFinancialStatsAction(month, year);
            if (!result.error) {
                setStats(result as any);
            }
        });
    };

    useEffect(() => {
        fetchData();
    }, [month, year]);

    const handlePreviousMonth = () => {
        if (month === 1) {
            setMonth(12);
            setYear(year - 1);
        } else {
            setMonth(month - 1);
        }
    };

    const handleNextMonth = () => {
        if (month === 12) {
            setMonth(1);
            setYear(year + 1);
        } else {
            setMonth(month + 1);
        }
    };

    const monthName = new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(year, month, 0).getDate();

    return (
        <div className="space-y-6">
            {/* Header / Controls */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <button
                    onClick={handlePreviousMonth}
                    className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg font-bold text-zinc-800 capitalize flex items-center gap-2">
                    {isPending && <Loader2 size={16} className="animate-spin text-blue-500" />}
                    {monthName}
                </h2>
                <button
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600 transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Value Card */}
            <div className={`p-6 rounded-2xl shadow-sm border ${stats?.role === 'motoboy' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${stats?.role === 'motoboy' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {stats?.role === 'motoboy' ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                    </div>
                    <span className={`text-sm font-bold uppercase tracking-wide ${stats?.role === 'motoboy' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {stats?.role === 'motoboy' ? 'Receita Total' : 'Despesa Total'}
                    </span>
                </div>
                <div className="text-4xl font-bold text-zinc-900">
                    {stats?.total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                </div>
                <p className="text-zinc-500 text-sm mt-1">
                    Acumulado em {monthName}
                </p>
            </div>

            {/* Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                <h3 className="font-bold text-zinc-800 mb-6">Visão Diária</h3>
                <div className="min-h-[300px]">
                    {stats && (
                        <DailyChart
                            data={stats.data}
                            totalDays={daysInMonth}
                            color={stats.role === 'motoboy' ? '#10b981' : '#ef4444'}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
