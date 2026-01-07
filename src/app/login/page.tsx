import { loginAction } from "../actions/auth";
import { cn } from "../../lib/utils";
import Link from "next/link";

export default function LoginPage() {
    return (
        <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-zinc-900 text-white">
            {/* Hero Section (Left/Top) */}
            <div className="hidden md:flex flex-col justify-center items-center bg-green-600 p-8">
                <div className="text-center">
                    <h1 className="text-5xl font-bold mb-4">Zap Entregas</h1>
                    <p className="text-xl max-w-md">
                        Gerencie suas entregas e finanças com agilidade.
                        Otimizado para lojistas e motoboys.
                    </p>
                </div>
            </div>

            {/* Login Form (Right/Bottom) */}
            <div className="flex flex-col justify-center items-center p-8">
                <div className="w-full max-w-sm space-y-8">
                    <div className="text-center md:text-left">
                        {/* Mobile Logo */}
                        <h2 className="text-4xl font-bold text-green-500 md:hidden mb-2">Zap Entregas</h2>
                        <h3 className="text-2xl font-semibold text-zinc-100">Acesse sua conta</h3>
                        <p className="text-zinc-400">Entre com seu número e senha</p>
                    </div>

                    <form action={loginAction} className="flex flex-col gap-5">
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium mb-1.5 text-zinc-300">Celular</label>
                            <input
                                id="phone"
                                name="phone"
                                type="text"
                                placeholder="21999999999"
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-zinc-300">Senha</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="••••••"
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            className="mt-2 w-full rounded-lg bg-green-600 py-3 font-bold text-white hover:bg-green-500 active:scale-[0.98] transition-all shadow-lg shadow-green-900/20"
                        >
                            Entrar
                        </button>
                    </form>

                    <div className="text-center text-sm text-zinc-500 mt-6">
                        Não tem conta?{" "}
                        <Link href="/register" className="text-green-500 hover:text-green-400 font-medium">
                            Cadastre-se agora
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
