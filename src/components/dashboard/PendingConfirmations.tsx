import { confirmTransactionAction, rejectTransactionAction } from "@/app/actions/finance";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingConfirmation {
    id: number;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    creatorName: string | null;
    createdAt: string;
}

export function PendingConfirmations({ confirmations }: { confirmations: PendingConfirmation[] }) {
    if (confirmations.length === 0) return null;

    return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-4 text-yellow-800">
                <AlertCircle className="w-5 h-5" />
                <h2 className="font-bold">Confirmações Pendentes</h2>
            </div>
            <div className="space-y-3">
                {confirmations.map((pc) => (
                    <div key={pc.id} className="bg-white p-4 rounded-xl shadow-sm border border-yellow-100 flex justify-between items-center">
                        <div>
                            <p className="font-medium text-zinc-900">{pc.description}</p>
                            <p className="text-sm text-zinc-500">
                                Lançado por: <span className="font-semibold">{pc.creatorName}</span> • {new Date(pc.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className={`font-bold ${pc.type === 'debit' ? 'text-green-600' : 'text-red-600'}`}>
                                {pc.type === 'debit' ? '+' : '-'} {pc.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>

                            <div className="flex gap-2">
                                <form action={async () => {
                                    "use server";
                                    await rejectTransactionAction(pc.id);
                                }}>
                                    <Button variant="danger" size="sm" className="bg-white border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 shadow-none">
                                        Rejeitar
                                    </Button>
                                </form>
                                <form action={async () => {
                                    "use server";
                                    await confirmTransactionAction(pc.id);
                                }}>
                                    <Button variant="success" size="sm">
                                        Confirmar
                                    </Button>
                                </form>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
