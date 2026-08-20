"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Link2Off, Loader2 } from "lucide-react";
import GoogleButton from "@/app/login/GoogleButton";
import { unlinkGoogleAction } from "@/app/actions/google-account";

interface GoogleAccountCardProps {
    connected: boolean;
    email: string | null;
    /** Servidor sem GOOGLE_CLIENT_ID: nem mostra a opção. */
    enabled: boolean;
    aviso?: string;
    sucesso?: boolean;
}

export default function GoogleAccountCard({ connected, email, enabled, aviso, sucesso }: GoogleAccountCardProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [erro, setErro] = useState("");

    if (!enabled) return null;

    const desconectar = () => {
        setErro("");
        startTransition(async () => {
            const res = await unlinkGoogleAction();
            if ("error" in res) { setErro(res.error); return; }
            router.refresh();
        });
    };

    return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 space-y-4">
            <div>
                <h2 className="font-bold text-white">Entrar com Google</h2>
                <p className="text-sm text-zinc-400 mt-1">
                    Conecte sua conta Google pra entrar no app sem digitar telefone e senha.
                </p>
            </div>

            {sucesso && (
                <p className="text-sm text-green-400 flex items-center gap-2">
                    <CheckCircle2 size={16} /> Conta Google conectada.
                </p>
            )}
            {(aviso || erro) && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
                    {erro || aviso}
                </p>
            )}

            {connected ? (
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-zinc-300 flex-1 min-w-0">
                        <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
                        <span className="truncate">{email || "conta conectada"}</span>
                    </div>
                    <button
                        type="button"
                        onClick={desconectar}
                        disabled={isPending}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Link2Off size={16} />}
                        Desconectar
                    </button>
                </div>
            ) : (
                <GoogleButton mode="link" label="Conectar minha conta Google" />
            )}
        </div>
    );
}
