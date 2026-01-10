"use client";

import { useState, useTransition } from "react";
import { Key, Copy, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { generateApiKeyAction } from "@/app/actions/settings";

interface ApiKeyFormProps {
    userId: number;
    currentApiKey: string | null;
}

export default function ApiKeyForm({ userId, currentApiKey }: ApiKeyFormProps) {
    const [apiKey, setApiKey] = useState<string | null>(currentApiKey);
    const [isPending, startTransition] = useTransition();
    const [copied, setCopied] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleGenerate = () => {
        if (apiKey && !showConfirm) {
            setShowConfirm(true);
            return;
        }

        startTransition(async () => {
            const result = await generateApiKeyAction();
            if (result.success && result.apiKey) {
                setApiKey(result.apiKey);
                setShowConfirm(false);
            }
        });
    };

    const copyToClipboard = () => {
        if (apiKey) {
            navigator.clipboard.writeText(apiKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="bg-zinc-800 rounded-2xl border border-zinc-700 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center">
                    <Key className="text-white" size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">Integração PDV</h3>
                    <p className="text-sm text-zinc-400">Chave de API para conectar seu PDV</p>
                </div>
            </div>

            {apiKey ? (
                <div className="space-y-4">
                    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-700">
                        <p className="text-xs text-zinc-500 mb-2">Sua API Key:</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-green-400 text-sm font-mono break-all">
                                {apiKey}
                            </code>
                            <button
                                onClick={copyToClipboard}
                                className="p-2 bg-zinc-700 rounded-lg hover:bg-zinc-600 transition-colors"
                                title="Copiar"
                            >
                                {copied ? (
                                    <Check size={16} className="text-green-400" />
                                ) : (
                                    <Copy size={16} className="text-zinc-400" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="bg-amber-600/20 border border-amber-600/40 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-amber-200 text-sm font-medium">Mantenha segura!</p>
                                <p className="text-amber-300/70 text-xs mt-1">
                                    Esta chave permite criar entregas no seu nome. Não compartilhe publicamente.
                                </p>
                            </div>
                        </div>
                    </div>

                    {showConfirm ? (
                        <div className="flex gap-2">
                            <button
                                onClick={handleGenerate}
                                disabled={isPending}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={16} className={isPending ? "animate-spin" : ""} />
                                {isPending ? "Gerando..." : "Confirmar Regeneração"}
                            </button>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-3 bg-zinc-700 text-zinc-300 rounded-xl font-bold hover:bg-zinc-600 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleGenerate}
                            className="w-full py-3 bg-zinc-700 text-zinc-300 rounded-xl font-medium hover:bg-zinc-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Regenerar API Key
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-zinc-400 text-sm">
                        Gere uma chave de API para integrar seu sistema de PDV com o Zap Entregas.
                        As entregas criadas via API aparecerão automaticamente para seus motoboys.
                    </p>

                    <button
                        onClick={handleGenerate}
                        disabled={isPending}
                        className="w-full py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-500 transition-colors flex items-center justify-center gap-2"
                    >
                        {isPending ? (
                            <>
                                <RefreshCw size={18} className="animate-spin" />
                                Gerando...
                            </>
                        ) : (
                            <>
                                <Key size={18} />
                                Gerar API Key
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
