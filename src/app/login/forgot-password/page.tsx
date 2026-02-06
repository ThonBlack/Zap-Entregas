"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { requestPasswordResetAction } from "../../actions/password-reset";

export default function ForgotPasswordPage() {
    const [identifier, setIdentifier] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const result = await requestPasswordResetAction(identifier);
            if (result.success) {
                setSuccess(true);
            }
        } catch (err) {
            setError("Erro ao processar solicitação. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-zinc-900 text-white">
            {/* Hero Section (Left) */}
            <div className="hidden md:flex md:w-1/2 flex-col justify-center items-center bg-gradient-to-br from-green-600 via-green-500 to-emerald-600 p-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-10 w-32 h-32 border-4 border-white rounded-full"></div>
                    <div className="absolute bottom-20 right-10 w-48 h-48 border-4 border-white rounded-full"></div>
                    <div className="absolute top-1/2 left-1/4 w-24 h-24 border-4 border-white rounded-full"></div>
                </div>

                <div className="text-center z-10">
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
                        Esqueceu sua senha? Não se preocupe!
                        Vamos te ajudar a recuperar o acesso.
                    </p>
                </div>
            </div>

            {/* Form Section (Right) */}
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

                    {/* Back Link */}
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Voltar ao login
                    </Link>

                    {success ? (
                        /* Success State */
                        <div className="space-y-6">
                            <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-6 rounded-xl flex flex-col items-center gap-4 text-center animate-in fade-in slide-in-from-top-2">
                                <CheckCircle size={48} />
                                <h3 className="text-xl font-bold text-white">Verifique seu email!</h3>
                                <p className="text-zinc-300">
                                    Se o telefone/email informado estiver cadastrado, você receberá um link para redefinir sua senha.
                                </p>
                            </div>
                            <p className="text-sm text-zinc-500 text-center">
                                Não recebeu o email? Verifique a pasta de spam ou tente novamente em alguns minutos.
                            </p>
                            <Link
                                href="/login"
                                className="block w-full rounded-xl bg-zinc-700 py-4 font-bold text-white text-lg text-center hover:bg-zinc-600 transition-all"
                            >
                                Voltar ao Login
                            </Link>
                        </div>
                    ) : (
                        /* Form State */
                        <>
                            <div className="text-center md:text-left">
                                <h3 className="text-2xl font-bold text-white mb-1">Esqueceu sua senha? 🔐</h3>
                                <p className="text-zinc-400">Informe seu telefone ou email cadastrado</p>
                            </div>

                            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-2">
                                        <AlertCircle size={18} />
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="identifier" className="block text-sm font-medium mb-2 text-zinc-300">
                                        Telefone ou Email
                                    </label>
                                    <input
                                        id="identifier"
                                        name="identifier"
                                        type="text"
                                        placeholder="21999999999 ou email@exemplo.com"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        required
                                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || !identifier}
                                    className="mt-2 w-full rounded-xl bg-green-600 py-4 font-bold text-white text-lg hover:bg-green-500 active:scale-[0.98] transition-all shadow-lg shadow-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Mail size={20} />
                                            Enviar Link de Recuperação
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Footer */}
                    <div className="text-center text-xs text-zinc-600 pt-4">
                        © 2026 Zap Entregas • Feito com 💚 no Brasil
                    </div>
                </div>
            </div>
        </div>
    );
}
