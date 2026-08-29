"use client";

import { useActionState } from "react";
import { KeyRound, AlertCircle, CheckCircle } from "lucide-react";

import { changePasswordAction, type TrocarSenhaState } from "@/app/actions/password";

const estadoInicial: TrocarSenhaState = null;

/**
 * Card "Trocar senha" das configurações.
 *
 * `temSenha = false` é quem entrou pelo Google ou pelo link de convite e nunca
 * criou senha: não faz sentido pedir a senha atual dele.
 */
export default function ChangePasswordCard({ temSenha }: { temSenha: boolean }) {
    const [state, formAction, isPending] = useActionState(changePasswordAction, estadoInicial);

    return (
        <div className="bg-zinc-800 p-6 rounded-xl shadow-sm border border-zinc-700">
            <h2 className="font-bold text-white mb-1 flex items-center gap-2">
                <KeyRound size={20} className="text-green-400" />
                {temSenha ? "Trocar senha" : "Criar senha"}
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
                {temSenha
                    ? "A senha nova vale no próximo login, em todos os aparelhos."
                    : "Você entra sem senha hoje. Criar uma deixa você entrar direto pelo telefone."}
            </p>

            <form action={formAction} className="space-y-4">
                {temSenha && (
                    <div>
                        <label htmlFor="currentPassword" className="block text-sm font-medium text-zinc-300 mb-1">
                            Senha atual
                        </label>
                        <input
                            id="currentPassword"
                            name="currentPassword"
                            type="password"
                            autoComplete="current-password"
                            required
                            className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                        />
                    </div>
                )}

                <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-zinc-300 mb-1">
                        Senha nova
                    </label>
                    <input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                    />
                    <p className="text-xs text-zinc-500 mt-1">Pelo menos 8 caracteres.</p>
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300 mb-1">
                        Repita a senha nova
                    </label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                    />
                </div>

                {state?.message && (
                    <div
                        role="status"
                        className={`p-3 rounded-lg text-sm flex items-start gap-2 ${state.success
                            ? "bg-green-500/10 border border-green-500/40 text-green-400"
                            : "bg-red-500/10 border border-red-500/40 text-red-400"}`}
                    >
                        {state.success ? <CheckCircle size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
                        <span>{state.message}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isPending ? "Salvando..." : temSenha ? "Trocar senha" : "Criar senha"}
                </button>
            </form>
        </div>
    );
}
