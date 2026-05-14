"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Key, RefreshCw, Copy, CheckCircle, AlertTriangle, Eye, EyeOff, Loader2, X } from "lucide-react";
import {
    adminGenerateApiKeyForUserAction,
    adminRevokeApiKeyForUserAction,
} from "@/app/actions/admin-users";

interface Props {
    userId: number;
    userName: string;
    currentApiKey: string | null;
}

function maskKey(key: string): string {
    if (key.length <= 16) return key;
    return key.slice(0, 10) + "•".repeat(20) + key.slice(-6);
}

export default function AdminApiKeyCard({ userId, userName, currentApiKey }: Props) {
    const [apiKey, setApiKey] = useState<string | null>(currentApiKey);
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmRotate, setConfirmRotate] = useState(false);
    const [confirmRevoke, setConfirmRevoke] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleGenerate = () => {
        setError(null);
        setConfirmRotate(false);
        startTransition(async () => {
            const res = await adminGenerateApiKeyForUserAction(userId);
            if ("error" in res) {
                setError(res.error || "Falha ao gerar API Key.");
            } else {
                setApiKey(res.apiKey || null);
                setRevealed(true);
            }
        });
    };

    const handleRevoke = () => {
        setError(null);
        setConfirmRevoke(false);
        startTransition(async () => {
            const res = await adminRevokeApiKeyForUserAction(userId);
            if ("error" in res) {
                setError(res.error || "Falha ao revogar.");
            } else {
                setApiKey(null);
                setRevealed(false);
            }
        });
    };

    const handleCopy = async () => {
        if (!apiKey) return;
        try {
            await navigator.clipboard.writeText(apiKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError("Falha ao copiar.");
        }
    };

    return (
        <Card className="p-6 bg-zinc-800 border-zinc-700">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Key size={20} className="text-emerald-400" />
                        API Key — integração com PDV
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">
                        Use esta chave em <strong>{userName}</strong> para criar entregas via POST /api/integration/delivery.
                    </p>
                </div>
            </div>

            {error && (
                <div className="mb-3 p-3 rounded-lg bg-red-600/20 text-red-300 border border-red-600/40 flex items-center gap-2 text-sm">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {apiKey ? (
                <>
                    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 flex items-center gap-2 font-mono text-sm break-all">
                        <code className="flex-1 text-emerald-300">
                            {revealed ? apiKey : maskKey(apiKey)}
                        </code>
                        <button
                            type="button"
                            onClick={() => setRevealed((v) => !v)}
                            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 shrink-0"
                            title={revealed ? "Ocultar" : "Mostrar"}
                        >
                            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 shrink-0"
                            title="Copiar"
                        >
                            {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
                        </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {!confirmRotate && !confirmRevoke && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setConfirmRotate(true)}
                                    disabled={isPending}
                                    className="flex items-center gap-2 px-3 py-2 bg-amber-600/20 text-amber-300 border border-amber-600/40 rounded-lg text-sm font-medium hover:bg-amber-600/30 disabled:opacity-50"
                                >
                                    <RefreshCw size={14} /> Regenerar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmRevoke(true)}
                                    disabled={isPending}
                                    className="flex items-center gap-2 px-3 py-2 bg-red-600/20 text-red-300 border border-red-600/40 rounded-lg text-sm font-medium hover:bg-red-600/30 disabled:opacity-50"
                                >
                                    <X size={14} /> Revogar
                                </button>
                            </>
                        )}
                        {confirmRotate && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-amber-300">A chave atual deixará de funcionar. Confirmar?</span>
                                <button
                                    type="button"
                                    onClick={handleGenerate}
                                    disabled={isPending}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
                                >
                                    {isPending && <Loader2 size={14} className="animate-spin" />}
                                    Sim, regenerar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmRotate(false)}
                                    className="px-3 py-1.5 bg-zinc-700 text-zinc-200 rounded text-sm hover:bg-zinc-600"
                                >
                                    Cancelar
                                </button>
                            </div>
                        )}
                        {confirmRevoke && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-red-300">Vai cortar acesso da loja imediatamente. Confirmar?</span>
                                <button
                                    type="button"
                                    onClick={handleRevoke}
                                    disabled={isPending}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-500 disabled:opacity-50"
                                >
                                    {isPending && <Loader2 size={14} className="animate-spin" />}
                                    Sim, revogar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmRevoke(false)}
                                    className="px-3 py-1.5 bg-zinc-700 text-zinc-200 rounded text-sm hover:bg-zinc-600"
                                >
                                    Cancelar
                                </button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="text-center py-6">
                    <p className="text-zinc-400 text-sm mb-4">Nenhuma API Key gerada ainda para este lojista.</p>
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
                    >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
                        Gerar API Key
                    </button>
                </div>
            )}
        </Card>
    );
}
