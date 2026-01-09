"use client";

import { useState, useTransition, useEffect } from "react";
import { getFinancialStatsAction } from "@/app/actions/finance";
import DailyChart from "./DailyChart";
import { ChevronLeft, ChevronRight, Loader2, TrendingDown, TrendingUp, Calendar, Target, Zap } from "lucide-react";

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

    // Calculate daily average and best day
    const dailyAverage = stats ? (stats.total / daysInMonth) : 0;
    const bestDay = stats?.data?.length ? Math.max(...stats.data.map(d => d.value)) : 0;
    const activeDays = stats?.data?.filter(d => d.value > 0).length || 0;

    return (
        <div className="space-y-6">
            {/* Header / Controls */}
            <div className="flex items-center justify-between bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                <button
                    onClick={handlePreviousMonth}
                    className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg font-bold text-white capitalize flex items-center gap-2">
                    {isPending && <Loader2 size={16} className="animate-spin text-green-400" />}
                    <Calendar size={18} className="text-green-400" />
                    {monthName}
                </h2>
                <button
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Stats Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total */}
                <div className={`p-4 rounded-xl border ${stats?.role === 'motoboy' ? 'bg-green-900/30 border-green-700' : 'bg-red-900/30 border-red-700'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        {stats?.role === 'motoboy' ? <TrendingUp size={18} className="text-green-400" /> : <TrendingDown size={18} className="text-red-400" />}
                        <span className={`text-xs font-bold uppercase ${stats?.role === 'motoboy' ? 'text-green-400' : 'text-red-400'}`}>
                            Total
                        </span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {stats?.total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                    </div>
                </div>

                {/* Daily Average */}
                <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700">
                    <div className="flex items-center gap-2 mb-2">
                        <Target size={18} className="text-yellow-400" />
                        <span className="text-xs font-bold uppercase text-yellow-400">Média/Dia</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {dailyAverage.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                </div>

                {/* Best Day */}
                <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap size={18} className="text-orange-400" />
                        <span className="text-xs font-bold uppercase text-orange-400">Melhor Dia</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {bestDay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                </div>

                {/* Active Days */}
                <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar size={18} className="text-blue-400" />
                        <span className="text-xs font-bold uppercase text-blue-400">Dias Ativos</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {activeDays} <span className="text-sm font-normal text-zinc-400">de {daysInMonth}</span>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-zinc-800 p-6 rounded-2xl border border-zinc-700">
                <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                    <TrendingUp size={18} className="text-green-400" />
                    Visão Diária
                </h3>
                <div className="min-h-[300px]">
                    {stats && (
                        <DailyChart
                            data={stats.data}
                            totalDays={daysInMonth}
                            color={stats.role === 'motoboy' ? '#22c55e' : '#ef4444'}
                        />
                    )}
                </div>
            </div>

            {/* Quick Summary */}
            <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                <p className="text-sm text-zinc-400 text-center">
                    {stats?.role === 'motoboy'
                        ? `💰 Você ganhou ${stats?.total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em ${activeDays} dias de trabalho`
                        : `📊 Despesas de ${monthName}: ${stats?.total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                    }
                </p>
            </div>
        </div>
    );
}
