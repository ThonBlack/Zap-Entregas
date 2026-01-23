"use client";

import { useMemo } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from "recharts";

interface DailyChartProps {
    data: { day: number; value: number }[];
    totalDays: number; // Days in the month
    color?: string;
}

export default function DailyChart({ data, totalDays, color = "#2563eb" }: DailyChartProps) {
    // Fill missing days with 0
    const chartData = useMemo(() => {
        const filledData = [];
        const dataMap = new Map(data.map(d => [d.day, d.value]));

        for (let i = 1; i <= totalDays; i++) {
            filledData.push({
                day: i,
                value: dataMap.get(i) || 0
            });
        }
        return filledData;
    }, [data, totalDays]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-zinc-200 shadow-lg rounded-xl">
                    <p className="text-sm font-bold text-zinc-900">Dia {label}</p>
                    <p className="text-sm text-zinc-600">
                        {payload[0].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 12 }}
                        tickFormatter={(value) => `R$${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f4f4f5' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.value > 0 ? color : 'transparent'}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
