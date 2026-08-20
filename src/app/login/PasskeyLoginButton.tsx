"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2 } from "lucide-react";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { startPasskeyLogin, finishPasskeyLogin } from "@/app/actions/passkeys";

export default function PasskeyLoginButton() {
    const router = useRouter();
    const [suportado, setSuportado] = useState(false);
    const [entrando, setEntrando] = useState(false);
    const [erro, setErro] = useState("");

    useEffect(() => { setSuportado(browserSupportsWebAuthn()); }, []);

    if (!suportado) return null;

    const entrar = async () => {
        setErro(""); setEntrando(true);
        try {
            const options = await startPasskeyLogin();
            if ("error" in options) { setErro(options.error); return; }

            const resposta = await startAuthentication({ optionsJSON: options });

            const res = await finishPasskeyLogin(resposta);
            if ("error" in res) { setErro(res.error); return; }

            router.push(res.twoFactor ? "/login/2fa" : "/app");
            router.refresh();
        } catch (e: unknown) {
            const nome = (e as { name?: string })?.name;
            if (nome === "NotAllowedError") setErro("Entrada por digital cancelada.");
            else setErro("Não consegui usar a digital neste aparelho.");
        } finally {
            setEntrando(false);
        }
    };

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={entrar}
                disabled={entrando}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-zinc-600 bg-zinc-800 py-3.5 font-semibold text-white hover:bg-zinc-700 active:scale-[0.98] transition-all disabled:opacity-60"
            >
                {entrando ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={20} className="text-green-400" />}
                Entrar com digital
            </button>
            {erro && <p className="text-sm text-red-400 text-center">{erro}</p>}
        </div>
    );
}
