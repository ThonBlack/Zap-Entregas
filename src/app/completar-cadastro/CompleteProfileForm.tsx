"use client";

import { useActionState } from "react";
import { AlertCircle, Phone, KeyRound, Check } from "lucide-react";
import { completarCadastroAction, type CompletarCadastroState } from "@/app/actions/complete-profile";

const initialState: CompletarCadastroState = {};

export default function CompleteProfileForm({ nome, email }: { nome: string; email: string | null }) {
    const [state, formAction, isPending] = useActionState(completarCadastroAction, initialState);

    return (
        <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-800 rounded-2xl shadow-2xl p-8 border border-zinc-700 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Falta pouco, {nome.split(" ")[0]}!</h1>
                    <p className="text-zinc-400 mt-2 text-sm">
                        Sua conta foi criada com o Google{email ? ` (${email})` : ""}. Só falta o seu
                        celular — é por ele que a loja fala com você e é ele que serve de login.
                    </p>
                </div>

                <form action={formAction} className="space-y-5">
                    <div>
                        <label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1">
                            <Phone size={16} /> Celular com DDD
                        </label>
                        <input
                            id="phone"
                            name="phone"
                            type="tel"
                            inputMode="numeric"
                            required
                            autoFocus
                            placeholder="34996802886"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white placeholder-zinc-600 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                        />
                        <p className="text-xs text-zinc-500 mt-1">Só números.</p>
                    </div>

                    <div>
                        <label htmlFor="password" className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1">
                            <KeyRound size={16} /> Senha <span className="text-zinc-500 font-normal">(opcional)</span>
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="••••••••"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white placeholder-zinc-600 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                        />
                        <p className="text-xs text-zinc-500 mt-1">
                            Só se quiser poder entrar sem o Google. Mínimo de 8 caracteres.
                        </p>
                    </div>

                    {state?.message && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl flex items-center gap-2 text-sm">
                            <AlertCircle size={18} className="flex-shrink-0" />
                            {state.message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
                    >
                        {isPending ? "Salvando..." : (<><Check size={18} /> Concluir cadastro</>)}
                    </button>
                </form>
            </div>
        </div>
    );
}
