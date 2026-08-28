"use client";

import { Bell, BellOff, Loader2, X, AlertTriangle } from "lucide-react";
import PasskeyInvite from "@/components/auth/PasskeyInvite";
import { usePushNotifications } from "./usePushNotifications";

/**
 * O que o app pede logo depois do login, em ordem e um de cada vez:
 *   1º avisos de corrida (sem isso o motoboy não fica sabendo do serviço);
 *   2º entrada por digital.
 *
 * Nunca os dois ao mesmo tempo — quem chega no app não entende dois convites
 * empilhados e acaba fechando os dois.
 */

interface FirstRunPromptsProps {
    userId: number;
    /** Usuário ainda não cadastrou digital nenhuma. */
    semDigital: boolean;
}

export default function FirstRunPrompts({ userId, semDigital }: FirstRunPromptsProps) {
    const { permissao, convidando, pedindo, erroInscricao, limparErro, pedirPermissao, adiarPorUmDia } =
        usePushNotifications(userId);

    return (
        <>
            {convidando && (
                <div className="bg-green-600/10 border border-green-600/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <Bell size={22} className="text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-white">Ativar avisos de corrida neste aparelho?</p>
                            <p className="text-sm text-zinc-300 mt-1">
                                Sem isso o celular não toca quando entra corrida nova — nem com o app fechado.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={pedirPermissao}
                            disabled={pedindo}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors disabled:opacity-50"
                        >
                            {pedindo ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
                            Ativar avisos
                        </button>
                        <button
                            type="button"
                            onClick={adiarPorUmDia}
                            className="px-4 py-3 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                            Depois
                        </button>
                    </div>
                </div>
            )}

            {permissao === "denied" && (
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-3">
                    <BellOff size={22} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-100 space-y-1">
                        <p className="font-bold">Avisos bloqueados neste aparelho</p>
                        <p className="text-amber-200/90">
                            Você não vai ser avisado de corrida nova. Pra liberar, no Chrome do Android:
                            toque no cadeado ao lado do endereço → <strong>Configurações do site</strong> →
                            {" "}<strong>Notificações</strong> → Permitir.
                        </p>
                        <p className="text-amber-200/90">
                            Se instalou o app na tela inicial: <strong>Configurações do Android</strong> →
                            {" "}Aplicativos → Zap Entregas → Notificações.
                        </p>
                    </div>
                </div>
            )}

            {/* A digital só entra em cena quando o convite dos avisos já saiu da frente. */}
            {!convidando && semDigital && <PasskeyInvite />}

            {erroInscricao && (
                <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:w-96 bg-red-950 border border-red-500/60 rounded-xl p-4 shadow-2xl flex items-start gap-3">
                    <AlertTriangle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-red-200">Os avisos não ficaram ligados</p>
                        <p className="text-xs text-red-300 mt-1 break-words">{erroInscricao}</p>
                    </div>
                    <button
                        type="button"
                        onClick={limparErro}
                        title="Fechar"
                        className="p-1 text-red-400 hover:text-red-200 transition-colors flex-shrink-0"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}
        </>
    );
}
