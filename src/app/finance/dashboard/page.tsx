import FinancialDashboard from "@/components/FinancialDashboard";
import Link from "next/link";
import { ArrowLeft, DollarSign } from "lucide-react";

export default function FinancialDashboardPage() {
    return (
        <div className="min-h-screen bg-zinc-900 pb-20 md:pb-8">
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-md">
                <Link href="/" className="p-2 hover:bg-zinc-700 rounded-full transition-colors text-zinc-400 hover:text-green-400">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex items-center gap-2">
                    <DollarSign size={20} className="text-green-400" />
                    <h1 className="text-xl font-bold text-white">Dashboard Financeiro</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-6">
                <FinancialDashboard />
            </main>
        </div>
    );
}
