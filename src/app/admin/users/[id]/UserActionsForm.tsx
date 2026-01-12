"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Ban, CheckCircle, Loader2 } from "lucide-react";

interface UserActionsFormProps {
    user: {
        id: number;
        name: string;
        plan: string;
        subscriptionStatus: string;
    };
}

export default function UserActionsForm({ user }: UserActionsFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [selectedPlan, setSelectedPlan] = useState(user.plan);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleChangePlan = async () => {
        if (selectedPlan === user.plan) return;

        startTransition(async () => {
            try {
                const res = await fetch('/api/admin/users/update-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, plan: selectedPlan })
                });
                const data = await res.json();
                if (data.success) {
                    setMessage({ type: 'success', text: 'Plano alterado com sucesso!' });
                    router.refresh();
                } else {
                    setMessage({ type: 'error', text: data.error || 'Erro ao alterar plano' });
                }
            } catch (e) {
                setMessage({ type: 'error', text: 'Erro de conexão' });
            }
        });
    };

    const handleToggleStatus = async () => {
        const newStatus = user.subscriptionStatus === 'active' ? 'inactive' : 'active';

        startTransition(async () => {
            try {
                const res = await fetch('/api/admin/users/update-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, status: newStatus })
                });
                const data = await res.json();
                if (data.success) {
                    setMessage({ type: 'success', text: `Usuário ${newStatus === 'active' ? 'reativado' : 'suspenso'} com sucesso!` });
                    router.refresh();
                } else {
                    setMessage({ type: 'error', text: data.error || 'Erro ao alterar status' });
                }
            } catch (e) {
                setMessage({ type: 'error', text: 'Erro de conexão' });
            }
        });
    };

    return (
        <div className="space-y-4">
            {message && (
                <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-600/20 text-green-300' : 'bg-red-600/20 text-red-300'}`}>
                    {message.text}
                </div>
            )}

            {/* Alterar Plano */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-zinc-400" />
                    <span className="text-zinc-400 text-sm">Plano:</span>
                </div>
                <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                </select>
                <button
                    onClick={handleChangePlan}
                    disabled={isPending || selectedPlan === user.plan}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                    Alterar Plano
                </button>
            </div>

            {/* Suspender/Reativar */}
            <div className="flex items-center gap-3">
                {user.subscriptionStatus === 'active' ? (
                    <button
                        onClick={handleToggleStatus}
                        disabled={isPending}
                        className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/40 rounded-lg text-sm font-medium hover:bg-red-600/30 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                        Suspender Usuário
                    </button>
                ) : (
                    <button
                        onClick={handleToggleStatus}
                        disabled={isPending}
                        className="px-4 py-2 bg-green-600/20 text-green-400 border border-green-600/40 rounded-lg text-sm font-medium hover:bg-green-600/30 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        Reativar Usuário
                    </button>
                )}
            </div>
        </div>
    );
}
