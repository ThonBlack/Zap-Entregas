import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
    id: number;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    createdAt: string;
    userName?: string;
}

interface FinancialSummaryProps {
    transactions: Transaction[];
    title?: string;
}

export function FinancialSummary({ transactions, title = "Últimas Movimentações" }: FinancialSummaryProps) {
    return (
        <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                    <DollarSign size={20} className="text-green-400" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-zinc-700">
                    {transactions.length === 0 ? (
                        <div className="p-8 text-center text-zinc-400 text-sm">Nenhuma movimentação recente.</div>
                    ) : (
                        transactions.map((t) => (
                            <div key={t.id} className="p-4 flex justify-between items-center hover:bg-zinc-700 transition-colors">
                                <div>
                                    <div className="font-medium text-white text-sm">
                                        {t.userName ? `${t.userName} (${t.type === 'credit' ? 'Pagamento' : 'Recebimento'})` : t.description}
                                    </div>
                                    <div className="text-xs text-zinc-400">
                                        {t.userName ? t.description : ""} • {new Date(t.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div
                                    className={cn(
                                        "font-mono font-bold text-sm",
                                        t.type === 'debit' ? "text-green-400" : "text-red-400"
                                    )}
                                >
                                    {t.type === 'debit' ? '+' : '-'} {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
