"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2, X } from "lucide-react";
import { usePasskeyRegistration } from "./usePasskeyRegistration";

/**
 * Convite pra ligar a entrada por digital logo depois do login.
 *
 * Só aparece se: o aparelho sabe fazer isso, a pessoa ainda não cadastrou
 * nenhuma digital e ela não disse "agora não" nos últimos 7 dias.
 */

const CHAVE_ADIADO = "zap_convite_digital_adiado_ate";
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

function adiadoAinda(): boolean {
    try {
        const ate = Number(localStorage.getItem(CHAVE_ADIADO) || 0);
        return Number.isFinite(ate) && ate > Date.now();
    } catch {
        return false; // navegador sem localStorage: mostra o convite mesmo assim
    }
}

function adiarPorSeteDias(): void {
    try {
        localStorage.setItem(CHAVE_ADIADO, String(Date.now() + SETE_DIAS));
    } catch {
        /* sem localStorage não dá pra lembrar; some só nesta visita */
    }
}

export default function PasskeyInvite() {
    const router = useRouter();
    const { suportado, cadastrando, erro, cadastrar } = usePasskeyRegistration();
    // Lido uma vez, na montagem. No servidor não existe localStorage e a resposta
    // sai "false", mas nada é desenhado até `suportado` virar true no navegador.
    const [adiado, setAdiado] = useState(adiadoAinda);
    const [pronto, setPronto] = useState(false);

    if (suportado !== true || adiado) return null;

    if (pronto) {
        return (
            <div className="bg-green-600/10 border border-green-600/40 rounded-2xl p-4 flex items-center gap-3">
                <Fingerprint size={22} className="text-green-400 flex-shrink-0" />
                <p className="text-sm text-green-300">
                    Digital ativada! Da próxima vez é só tocar em <strong>Entrar com digital</strong>.
                </p>
            </div>
        );
    }

    const ativar = async () => {
        if (await cadastrar()) {
            setPronto(true);
            router.refresh();
        }
    };

    const agoraNao = () => {
        adiarPorSeteDias();
        setAdiado(true);
    };

    return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
                <Fingerprint size={22} className="text-green-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-white">Ativar entrada por digital neste aparelho?</p>
                    <p className="text-sm text-zinc-400 mt-1">
                        Da próxima vez você entra com a digital (ou o desbloqueio de tela), sem digitar senha.
                        A digital não sai do celular.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={agoraNao}
                    title="Agora não"
                    className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
                >
                    <X size={18} />
                </button>
            </div>

            {erro && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">{erro}</p>
            )}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={ativar}
                    disabled={cadastrando}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors disabled:opacity-50"
                >
                    {cadastrando ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
                    Ativar
                </button>
                <button
                    type="button"
                    onClick={agoraNao}
                    className="px-4 py-2.5 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                    Agora não
                </button>
            </div>
        </div>
    );
}
