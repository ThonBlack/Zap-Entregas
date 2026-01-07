import FinancialDashboard from "@/components/FinancialDashboard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function FinancialDashboardPage() {
    return (
        <div className="min-h-screen bg-zinc-50 pb-20 md:pb-8">
            <header className="bg-white border-b border-zinc-200 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-sm">
                <Link href="/" className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-xl font-bold text-zinc-900">Dashboard Financeiro</h1>
            </header>

            <main className="max-w-2xl mx-auto p-6">
                <FinancialDashboard />
            </main>
        </div>
    );
}
