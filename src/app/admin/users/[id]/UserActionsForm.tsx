"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Ban, CheckCircle, Loader2, KeyRound, RefreshCw, Copy, AlertTriangle } from "lucide-react";
import { adminResetUserPasswordAction } from "@/app/actions/admin";

interface UserActionsFormProps {
    user: {
        id: number;
        name: string;
        plan: string;
        subscriptionStatus: string;
    };
}

function genPassword(len = 12) {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
    return out;
}

export default function UserActionsForm({ user }: UserActionsFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [selectedPlan, setSelectedPlan] = useState(user.plan);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Reset de senha
    const [showPwReset, setShowPwReset] = useState(false);
    const [newPw, setNewPw] = useState(genPassword(12));
    const [pwApplied, setPwApplied] = useState<string | null>(null);
    const [pwCopied, setPwCopied] = useState(false);

    const handleChangePlan = async () => {
        if (selectedPlan === user.plan) return;
        startTransition(async () => {
            try {
                const res = await fetch("/api/admin/users/update-plan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: user.id, plan: selectedPlan }),
                });
                const data = await res.json();
                if (data.success) {
                    setMessage({ type: "success", text: "Plano alterado com sucesso!" });
                    router.refresh();
                } else {
                    setMessage({ type: "error", text: data.error || "Erro ao alterar plano" });
                }
            } catch {
                setMessage({ type: "error", text: "Erro de conexão" });
            }
        });
    };

    const handleToggleStatus = async () => {
        const newStatus = user.subscriptionStatus === "active" ? "inactive" : "active";
        startTransition(async () => {
            try {
                const res = await fetch("/api/admin/users/update-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: user.id, status: newStatus }),
                });
                const data = await res.json();
                if (data.success) {
                    setMessage({ type: "success", text: `Usuário ${newStatus === "active" ? "reativado" : "suspenso"} com sucesso!` });
                    router.refresh();
                } else {
                    setMessage({ type: "error", text: data.error || "Erro ao alterar status" });
                }
            } catch {
                setMessage({ type: "error", text: "Erro de conexão" });
            }
        });
    };

    const handleResetPassword = () => {
        if (!newPw || newPw.length < 8) {
            setMessage({ type: "error", text: "Senha precisa ter pelo menos 8 caracteres." });
            return;
        }
        startTransition(async () => {
            const res = await adminResetUserPasswordAction(user.id, newPw);
            if ("error" in res) {
                setMessage({ type: "error", text: res.error || "Falha ao resetar senha." });
            } else {
                setPwApplied(newPw);
                setShowPwReset(false);
                setMessage({ type: "success", text: "Senha resetada — copie e envie ao usuário." });
            }
        });
    };

    const copyPw = async () => {
        if (!pwApplied) return;
        try {
            await navigator.clipboard.writeText(pwApplied);
            setPwCopied(true);
            setTimeout(() => setPwCopied(false), 2000);
        } catch {}
    };

    return (
        <div className="space-y-4">
            {message && (
                <div className={`p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-600/20 text-green-300" : "bg-red-600/20 text-red-300"}`}>
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
                    <option value="free">Free (30 entregas)</option>
                    <option value="basic">Basic (150 entregas)</option>
                    <option value="pro">Pro (500 entregas)</option>
                    <option value="growth">Growth (1500 entregas)</option>
                    <option value="enterprise">Enterprise (Ilimitado)</option>
                </select>
                <button
                    onClick={handleChangePlan}
                    disabled={isPending || selectedPlan === user.plan}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                    Alterar Plano
                </button>
            </div>

            {/* Suspender/Reativar */}
            <div className="flex items-center gap-3">
                {user.subscriptionStatus === "active" ? (
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

            {/* Resetar Senha */}
            <div className="pt-4 border-t border-zinc-700/50">
                {pwApplied ? (
                    <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 flex items-center gap-3 flex-wrap">
                        <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="text-amber-200 text-xs font-bold uppercase tracking-wider">Nova senha (mostrada só uma vez)</div>
                            <code className="text-amber-100 font-mono text-base">{pwApplied}</code>
                        </div>
                        <button
                            type="button"
                            onClick={copyPw}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-700/40 hover:bg-amber-700/60 text-amber-100 rounded text-sm font-medium"
                        >
                            {pwCopied ? <CheckCircle size={14} /> : <Copy size={14} />}
                            {pwCopied ? "Copiado!" : "Copiar"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setPwApplied(null)}
                            className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded text-sm"
                        >
                            Fechar
                        </button>
                    </div>
                ) : showPwReset ? (
                    <div className="flex items-center gap-2 flex-wrap">
                        <KeyRound size={18} className="text-zinc-400" />
                        <input
                            type="text"
                            value={newPw}
                            onChange={(e) => setNewPw(e.target.value)}
                            minLength={8}
                            className="flex-1 min-w-[180px] bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono"
                        />
                        <button
                            type="button"
                            onClick={() => setNewPw(genPassword(12))}
                            className="p-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                            title="Gerar nova senha"
                        >
                            <RefreshCw size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={handleResetPassword}
                            disabled={isPending}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                        >
                            {isPending && <Loader2 size={14} className="animate-spin" />}
                            Confirmar reset
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowPwReset(false)}
                            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm"
                        >
                            Cancelar
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => { setShowPwReset(true); setNewPw(genPassword(12)); }}
                        className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                        <KeyRound size={16} />
                        Resetar Senha
                    </button>
                )}
            </div>
        </div>
    );
}
