"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2, Plus, Trash2 } from "lucide-react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { startPasskeyRegistration, finishPasskeyRegistration, deletePasskeyAction } from "@/app/actions/passkeys";

export interface PasskeyItem {
    id: number;
    deviceName: string | null;
    createdAt: string | null;
    lastUsedAt: string | null;
}

interface PasskeyCardProps {
    passkeys: PasskeyItem[];
}

const quando = (iso: string | null) => {
    if (!iso) return null;
    // Datas do SQLite vêm em UTC sem fuso.
    const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });
};

export default function PasskeyCard({ passkeys }: PasskeyCardProps) {
    const router = useRouter();
    const [suportado, setSuportado] = useState<boolean | null>(null);
    const [erro, setErro] = useState("");
    const [ok, setOk] = useState("");
    const [cadastrando, setCadastrando] = useState(false);
    const [isPending, startTransition] = useTransition();

    useEffect(() => { setSuportado(browserSupportsWebAuthn()); }, []);

    const cadastrar = async () => {
        setErro(""); setOk(""); setCadastrando(true);
        try {
            const options = await startPasskeyRegistration();
            if ("error" in options) { setErro(options.error); return; }

            const resposta = await startRegistration({ optionsJSON: options });

            const res = await finishPasskeyRegistration(resposta);
            if ("error" in res) { setErro(res.error); return; }

            setOk("Pronto! Agora dá pra entrar com a digital deste aparelho.");
            router.refresh();
        } catch (e: unknown) {
            const nome = (e as { name?: string })?.name;
            if (nome === "NotAllowedError") setErro("Cadastro cancelado.");
            else if (nome === "InvalidStateError") setErro("Este aparelho já está cadastrado.");
            else setErro("Não consegui cadastrar a digital neste aparelho.");
        } finally {
            setCadastrando(false);
        }
    };

    const remover = (id: number) => {
        setErro(""); setOk("");
        startTransition(async () => {
            const res = await deletePasskeyAction(id);
            if ("error" in res) { setErro(res.error); return; }
            router.refresh();
        });
    };

    return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
                <Fingerprint size={22} className="text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                    <h2 className="font-bold text-white">Desbloqueio por digital</h2>
                    <p className="text-sm text-zinc-400 mt-1">
                        Entre no app com a digital (ou o desbloqueio de tela) do próprio aparelho, sem digitar senha.
                        A digital não sai do celular — o app nunca recebe a sua impressão.
                    </p>
                </div>
            </div>

            {suportado === false && (
                <p className="text-sm text-yellow-300 bg-yellow-500/10 border border-yellow-500/40 rounded-lg px-3 py-2">
                    Este navegador não tem suporte a digital. No Android, use o Chrome ou instale o app na tela inicial.
                </p>
            )}
            {ok && <p className="text-sm text-green-400">{ok}</p>}
            {erro && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">{erro}</p>
            )}

            {passkeys.length > 0 && (
                <ul className="divide-y divide-zinc-700 border border-zinc-700 rounded-xl overflow-hidden">
                    {passkeys.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-900/40">
                            <Fingerprint size={18} className="text-zinc-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-white truncate">{p.deviceName || "Aparelho"}</p>
                                <p className="text-xs text-zinc-500">
                                    {quando(p.createdAt) && `cadastrado em ${quando(p.createdAt)}`}
                                    {p.lastUsedAt && ` · usado em ${quando(p.lastUsedAt)}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => remover(p.id)}
                                disabled={isPending}
                                title="Remover este aparelho"
                                className="p-2 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                                <Trash2 size={16} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {suportado !== false && (
                <button
                    type="button"
                    onClick={cadastrar}
                    disabled={cadastrando}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors disabled:opacity-50"
                >
                    {cadastrando ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    {passkeys.length ? "Cadastrar mais um aparelho" : "Cadastrar este aparelho"}
                </button>
            )}
        </div>
    );
}
