"use client";

import { registerAction } from "../actions/register";
import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
    const [role, setRole] = useState<"shopkeeper" | "motoboy">("shopkeeper");

    return (
        <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-800 rounded-xl shadow-2xl p-8 border border-zinc-700">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Crie sua Conta</h1>
                    <p className="text-zinc-400">Junte-se ao Zap Entregas</p>
                </div>

                <form action={registerAction} className="space-y-6">
                    {/* Role Selection */}
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
                    <input type="hidden" name="role" value={role} />

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">Nome Completo</label>
                            <input
                                name="name"
                                type="text"
                                required
                                placeholder="Seu nome ou da Loja"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">Celular (Login)</label>
                            <input
                                name="phone"
                                type="text"
                                required
                                placeholder="21999999999"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">Senha</label>
                            <input
                                name="password"
                                type="password"
                                required
                                placeholder="••••••••"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-all transform active:scale-[0.98] shadow-lg shadow-green-900/20"
                    >
                        Cadastrar
                    </button>
                </form>

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
