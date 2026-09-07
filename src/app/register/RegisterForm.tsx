"use client";

import { registerAction } from "../actions/register";
import Link from "next/link";
import { useState, useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import GoogleButton from "../login/GoogleButton";

const initialState = {
    message: "",
};

interface RegisterFormProps {
    /** Servidor sem GOOGLE_CLIENT_ID: o botão nem aparece. */
    googleEnabled: boolean;
    /**
     * Código de convite da loja, já conferido no servidor. Sem ele a tela é só
     * de motoboy — conta de lojista não sai por cadastro aberto.
     */
    conviteLojista: string | null;
}

function RegisterInner({ googleEnabled, conviteLojista }: RegisterFormProps) {
    const sp = useSearchParams();
    const podeSerLojista = !!conviteLojista;
    // O padrão é motoboy: é o cadastro que qualquer um pode fazer.
    const initialRole = podeSerLojista && sp?.get("role") === "shopkeeper" ? "shopkeeper" : "motoboy";
    const [role, setRole] = useState<"shopkeeper" | "motoboy">(initialRole);
    const [state, formAction, isPending] = useActionState(registerAction, initialState);

    return (
        <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-800 rounded-xl shadow-2xl p-8 border border-zinc-700">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Crie sua Conta</h1>
                    <p className="text-zinc-400">Junte-se ao Zap Entregas</p>
                </div>

                <form action={formAction} className="space-y-6">
                    {/* Escolher o papel só faz sentido com o convite da loja em mãos.
                        Sem ele, esta tela é a de cadastro de motoboy e ponto. */}
                    {podeSerLojista ? (
                        <div className="grid grid-cols-2 gap-4 p-1 bg-zinc-700/50 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setRole("shopkeeper")}
                                className={`p-3 rounded-md text-sm font-medium transition-all ${role === "shopkeeper"
                                    ? "bg-green-600 text-white shadow-lg"
                                    : "text-zinc-400 hover:text-white hover:bg-zinc-600"
                                    }`}
                            >
                                Sou Lojista
                            </button>
                            <button
                                type="button"
                                onClick={() => setRole("motoboy")}
                                className={`p-3 rounded-md text-sm font-medium transition-all ${role === "motoboy"
                                    ? "bg-green-600 text-white shadow-lg"
                                    : "text-zinc-400 hover:text-white hover:bg-zinc-600"
                                    }`}
                            >
                                Sou Motoboy
                            </button>
                        </div>
                    ) : (
                        <p className="text-center text-sm text-zinc-400 bg-zinc-700/40 rounded-lg p-3">
                            Cadastro de <strong className="text-zinc-200">motoboy</strong>. Conta de
                            loja é criada pela própria loja.
                        </p>
                    )}
                    <input type="hidden" name="role" value={role} />
                    {conviteLojista && (
                        <input type="hidden" name="convite_lojista" value={conviteLojista} />
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">Nome Completo</label>
                            <input
                                name="name"
                                type="text"
                                autoComplete="name"
                                required
                                placeholder="Seu nome ou da Loja"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">Celular (Login)</label>
                            <input
                                name="phone"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel"
                                required
                                placeholder="21999999999"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">
                                Email <span className="text-zinc-500 font-normal">(para recuperação de senha)</span>
                            </label>
                            <input
                                name="email"
                                type="email"
                                autoComplete="email"
                                inputMode="email"
                                placeholder="seu@email.com"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">Senha</label>
                            <input
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                placeholder="••••••••"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>

                    {state?.message && (
                        <div className="bg-red-500/10 text-red-500 text-sm p-3 rounded-lg text-center">
                            {state.message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all transform active:scale-[0.98] shadow-lg shadow-green-900/20"
                    >
                        {isPending ? "Criando conta..." : "Cadastrar"}
                    </button>
                </form>

                {googleEnabled && (
                    <div className="mt-6 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-zinc-700" />
                            <span className="text-xs text-zinc-500 uppercase tracking-wide">ou</span>
                            <div className="h-px flex-1 bg-zinc-700" />
                        </div>
                        <GoogleButton label="Criar conta com Google" />
                        <p className="text-xs text-zinc-500 text-center leading-relaxed">
                            Pelo Google a conta sai pronta como <strong className="text-zinc-400">motoboy</strong>, sem senha —
                            depois o app pede seu celular.
                        </p>
                    </div>
                )}

                <div className="mt-6 text-center text-sm text-zinc-500">
                    Já tem uma conta?{" "}
                    <Link href="/login" className="text-green-500 hover:text-green-400 font-medium">
                        Fazer Login
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function RegisterForm({ googleEnabled, conviteLojista }: RegisterFormProps) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-900" />}>
            <RegisterInner googleEnabled={googleEnabled} conviteLojista={conviteLojista} />
        </Suspense>
    );
}
