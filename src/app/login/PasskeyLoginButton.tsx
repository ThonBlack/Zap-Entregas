"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2 } from "lucide-react";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { startPasskeyLogin, finishPasskeyLogin } from "@/app/actions/passkeys";

/** Recado pra quem toca no botão sem ter ativado a digital neste aparelho. */
const PRECISA_ATIVAR =
    "Ainda não há digital ativada neste aparelho. Entre uma vez com celular e senha (ou com o Google) " +
    "e toque em “Ativar” no convite que aparece — depois é só a digital.";

export default function PasskeyLoginButton() {
    const router = useRouter();
    // null = ainda não sei se o navegador suporta (só dá pra testar depois de montar).
    const [suportado, setSuportado] = useState<boolean | null>(null);
    const [entrando, setEntrando] = useState(false);
    const [erro, setErro] = useState("");
    const [dica, setDica] = useState("");

    useEffect(() => { setSuportado(browserSupportsWebAuthn()); }, []);

    const entrar = async () => {
        setErro(""); setDica("");

        if (suportado === false) {
            setDica("Este navegador não sabe usar digital. No Android, use o Chrome ou instale o app na tela inicial.");
            return;
        }

        setEntrando(true);
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
            // O navegador dá o mesmo erro pra "cancelei" e pra "não achei digital
            // nenhuma deste site aqui" — então o recado cobre os dois casos.
            if (nome === "NotAllowedError") setDica(PRECISA_ATIVAR);
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
            {dica && (
                <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2 leading-relaxed">
                    {dica}
                </p>
            )}
            {erro && <p className="text-sm text-red-400 text-center">{erro}</p>}
        </div>
    );
}
