import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_LABEL, type TransactionKind } from "@/lib/wallet-shared";
import { fmtShortDateTime } from "@/lib/datetime";

interface Transaction {
    id: number;
    amount: number;
    type: 'credit' | 'debit';
    /** corrida | dinheiro | pagamento | ajuste | abertura — pode faltar em registros antigos. */
    kind?: TransactionKind | null;
    description: string;
    createdAt: string;
    userName?: string;
}

interface FinancialSummaryProps {
    transactions: Transaction[];
    title?: string;
}

/**
 * Últimas movimentações vistas PELA LOJA.
 *
 * A conta mora na carteira do motoboy (ver src/lib/wallet.ts): "credit" aumenta o
 * que a loja deve a ele, "debit" diminui. A tela repete esse sinal — verde pra
 * crédito, vermelho pra débito, igual ao extrato — e escreve por extenso o que
 * aconteceu, do ponto de vista de quem está olhando: o lojista.
 */
function explicarParaLoja(t: Transaction): string {
    const kind = (t.kind ?? null) as TransactionKind | null;
    const isCredit = t.type === 'credit';

    switch (kind) {
        case "corrida":
            return "a pagar ao motoboy";
        case "dinheiro":
            return "o motoboy ficou com o dinheiro do cliente";
        case "pagamento":
            return isCredit ? "o motoboy te entregou dinheiro" : "você pagou o motoboy";
        case "ajuste":
            return isCredit ? "a favor do motoboy" : "cobrado do motoboy";
        case "abertura":
            return isCredit ? "saldo inicial: você deve a ele" : "saldo inicial: ele deve a você";
        default:
            // Lançamento antigo, sem tipo gravado: fala só o rumo do dinheiro.
            return isCredit ? "aumenta o que você deve ao motoboy" : "abate o que você deve ao motoboy";
    }
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
                        transactions.map((t) => {
                            const isCredit = t.type === 'credit';
                            const rotulo = t.kind ? KIND_LABEL[t.kind] : "Lançamento";
                            return (
                                <div key={t.id} className="p-4 flex justify-between items-start gap-3 hover:bg-zinc-700 transition-colors">
                                    <div className="min-w-0">
                                        <div className="font-medium text-white text-sm truncate">
                                            {t.userName ? `${rotulo} · ${t.userName}` : rotulo}
                                        </div>
                                        <div className="text-xs text-zinc-400 truncate">
                                            {explicarParaLoja(t)}
                                        </div>
                                        <div className="text-xs text-zinc-500 truncate">
                                            {t.description ? `${t.description} • ` : ""}{fmtShortDateTime(t.createdAt)}
                                        </div>
                                    </div>
                                    <div
                                        className={cn(
                                            "font-mono font-bold text-sm shrink-0",
                                            isCredit ? "text-green-400" : "text-red-400"
                                        )}
                                    >
                                        {isCredit ? '+' : '−'} {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
