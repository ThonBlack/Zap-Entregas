import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { requireMotoboy } from "@/lib/session";
import { getStatement } from "@/lib/wallet";
import StatementView from "@/components/finance/StatementView";

function parseMonth(sp: { m?: string; y?: string }) {
    const now = new Date();
    const m = Number(sp.m), y = Number(sp.y);
    const okM = Number.isInteger(m) && m >= 1 && m <= 12;
    const okY = Number.isInteger(y) && y >= 2020 && y <= 2100;
    return { month: okM ? m : now.getMonth() + 1, year: okY ? y : now.getFullYear() };
}

export default async function ExtratoPage({ searchParams }: { searchParams: Promise<{ m?: string; y?: string }> }) {
    const user = await requireMotoboy();
    const { month, year } = parseMonth(await searchParams);
    const statement = await getStatement(user.id, month, year);

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-md">
                <Link href="/app" className="text-zinc-400 hover:text-green-400 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-bold text-white flex-1">Meu extrato</h1>
                <Link href="/finance/dashboard" className="text-zinc-400 hover:text-green-400" title="Gráfico do mês">
                    <BarChart3 size={22} />
                </Link>
            </header>
            <main className="max-w-2xl mx-auto p-4">
                <StatementView statement={statement} basePath="/finance/extrato" perspective="motoboy" />
            </main>
        </div>
    );
}
