"use client";

import { loginAction } from "../actions/auth";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Zap } from "lucide-react";
import Image from "next/image";

const initialState = {
    error: "",
};

export default function LoginPage() {
    const [state, formAction, isPending] = useActionState(loginAction, initialState);

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-zinc-900 text-white">
            {/* Hero Section (Left) */}
            <div className="hidden md:flex md:w-1/2 flex-col justify-center items-center bg-gradient-to-br from-green-600 via-green-500 to-emerald-600 p-8 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-10 w-32 h-32 border-4 border-white rounded-full"></div>
                    <div className="absolute bottom-20 right-10 w-48 h-48 border-4 border-white rounded-full"></div>
                    <div className="absolute top-1/2 left-1/4 w-24 h-24 border-4 border-white rounded-full"></div>
                </div>

                <div className="text-center z-10">
                    {/* Logo */}
                    <div className="w-32 h-32 mx-auto mb-6 bg-white rounded-3xl p-2 shadow-2xl">
                        <Image
                            src="/logo.png"
                            alt="Zap Entregas"
                            width={128}
                            height={128}
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">Zap Entregas</h1>
                    <p className="text-xl max-w-md text-green-100">
                        Gerencie suas entregas e finanças com agilidade.
                        Otimizado para lojistas e motoboys.
                    </p>

                    {/* Features */}
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                            📱 PWA Instalável
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                            📍 Rastreamento GPS
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                            💰 Gestão Financeira
                        </div>
                    </div>
                </div>
            </div>

            {/* Login Form (Right) */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-8">
                <div className="w-full max-w-sm space-y-8">
                    {/* Mobile Logo */}
                    <div className="text-center md:hidden mb-4">
                        <div className="w-20 h-20 mx-auto mb-4 bg-green-600 rounded-2xl p-2 shadow-lg">
                            <Image
                                src="/logo.png"
                                alt="Zap Entregas"
                                width={80}
                                height={80}
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <h2 className="text-3xl font-bold text-white">Zap Entregas</h2>
                    </div>

                    <div className="text-center md:text-left">
                        <h3 className="text-2xl font-bold text-white mb-1">Bem-vindo de volta! 👋</h3>
                        <p className="text-zinc-400">Entre com seu número e senha</p>
                    </div>

                    <form action={formAction} className="flex flex-col gap-5">
                        {state?.error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-2">
                                <AlertCircle size={18} />
                                {state.error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium mb-2 text-zinc-300">Celular</label>
                            <input
                                id="phone"
                                name="phone"
                                type="text"
                                placeholder="21999999999"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium mb-2 text-zinc-300">Senha</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="••••••"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isPending}
                            className="mt-2 w-full rounded-xl bg-green-600 py-4 font-bold text-white text-lg hover:bg-green-500 active:scale-[0.98] transition-all shadow-lg shadow-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isPending ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Entrando...
                                </>
                            ) : (
                                <>
                                    <Zap size={20} />
                                    Entrar
                                </>
                            )}
                        </button>
                    </form>

                    <div className="text-center">
                        <Link href="/login/forgot-password" className="text-sm text-zinc-400 hover:text-green-400 transition-colors">
                            Esqueci minha senha
                        </Link>
                    </div>

                    <div className="text-center text-sm text-zinc-400">
                        Não tem conta?{" "}
                        <Link href="/register" className="text-green-400 hover:text-green-300 font-semibold">
                            Cadastre-se agora
                        </Link>
                    </div>

                    {/* Footer */}
                    <div className="text-center text-xs text-zinc-600 pt-4">
                        © 2026 Zap Entregas • Feito com 💚 no Brasil
                    </div>
                </div>
            </div>
        </div>
    );
}
