// Título da aba: sem isso toda tela do app se chama "Zap Entregas".
export const metadata = { title: "Meu extrato · Zap Entregas" };

import Link from "next/link";
import { ArrowLeft, BarChart3, CalendarCheck } from "lucide-react";
import { requireMotoboy } from "@/lib/session";
import { getStatement } from "@/lib/wallet";
import StatementView, { type MarcadorFechamento } from "@/components/finance/StatementView";
import FechamentoPendente from "@/components/finance/FechamentoPendente";
import { getRespondedClosingsByDay } from "@/lib/dailyClosing";
import { parseMonth } from "@/lib/wallet-shared";

export default async function ExtratoPage({ searchParams }: { searchParams: Promise<{ m?: string; y?: string }> }) {
    const user = await requireMotoboy();
    const { month, year } = parseMonth(await searchParams);
    const statement = await getStatement(user.id, month, year);

    // Dias já conferidos com a loja viram um marcador na lista (não são lançamento).
    const respondidos = await getRespondedClosingsByDay(user.id);
    const fechamentos: MarcadorFechamento[] = [...respondidos.values()].map(c => ({
        day: c.day,
        net: c.net,
        status: c.status as "confirmed" | "disputed",
    }));

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-md">
                <Link href="/app" className="text-zinc-400 hover:text-green-400 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-bold text-white flex-1">Meu extrato</h1>
                <Link href="/finance/extrato/controle" className="text-zinc-400 hover:text-green-400" title="Controle por dia, semana e mês">
                    <CalendarCheck size={22} />
                </Link>
                <Link href="/finance/dashboard" className="text-zinc-400 hover:text-green-400" title="Gráfico do mês">
                    <BarChart3 size={22} />
                </Link>
            </header>
            <main className="max-w-2xl mx-auto p-4 space-y-4">
                <FechamentoPendente motoboyId={user.id} />

                <Link
                    href="/finance/extrato/controle"
                    className="min-h-11 flex items-center justify-center gap-2 bg-zinc-800 border-2 border-green-600 text-white p-3 rounded-2xl font-bold active:scale-[0.98] hover:bg-zinc-700"
                >
                    <CalendarCheck size={20} className="text-green-400" /> Controle por dia, semana e mês
                </Link>

                <StatementView
                    statement={statement}
                    basePath="/finance/extrato"
                    perspective="motoboy"
                    fechamentos={fechamentos}
                />
            </main>
        </div>
    );
}
