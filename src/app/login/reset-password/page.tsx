"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, ArrowLeft, Lock, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { validateResetTokenAction, resetPasswordAction } from "../../actions/password-reset";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isValidating, setIsValidating] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [tokenError, setTokenError] = useState("");
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    // Valida token ao carregar
    useEffect(() => {
        async function validateToken() {
            if (!token) {
                setTokenError("Link inválido. Solicite um novo link de recuperação.");
                setIsValidating(false);
                return;
            }

            const result = await validateResetTokenAction(token);
            if (result.valid) {
                setTokenValid(true);
            } else {
                setTokenError(result.error || "Link inválido ou expirado.");
            }
            setIsValidating(false);
        }

        validateToken();
    }, [token]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }

        if (password.length < 4) {
            setError("A senha deve ter pelo menos 4 caracteres.");
            return;
        }

        setIsLoading(true);

        try {
            const result = await resetPasswordAction(token, password);
            if (result.success) {
                setSuccess(true);
            } else if (result.error) {
                setError(result.error);
            }
        } catch (err) {
            setError("Erro ao redefinir senha. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    }

    // Loading state
    if (isValidating) {
        return (
            <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto"></div>
                <p className="text-zinc-400">Validando link...</p>
            </div>
        );
    }

    // Token invalid state
    if (!tokenValid) {
        return (
            <div className="space-y-6">
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-6 rounded-xl flex flex-col items-center gap-4 text-center animate-in fade-in slide-in-from-top-2">
                    <XCircle size={48} />
                    <h3 className="text-xl font-bold text-white">Link Inválido</h3>
                    <p className="text-zinc-300">{tokenError}</p>
                </div>
                <Link
                    href="/login/forgot-password"
                    className="block w-full rounded-xl bg-green-600 py-4 font-bold text-white text-lg text-center hover:bg-green-500 transition-all"
                >
                    Solicitar Novo Link
                </Link>
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div className="space-y-6">
                <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-6 rounded-xl flex flex-col items-center gap-4 text-center animate-in fade-in slide-in-from-top-2">
                    <CheckCircle size={48} />
                    <h3 className="text-xl font-bold text-white">Senha Redefinida!</h3>
                    <p className="text-zinc-300">
                        Sua senha foi alterada com sucesso. Você já pode fazer login.
                    </p>
                </div>
                <Link
                    href="/login"
                    className="block w-full rounded-xl bg-green-600 py-4 font-bold text-white text-lg text-center hover:bg-green-500 transition-all shadow-lg shadow-green-900/30"
                >
                    Ir para Login
                </Link>
            </div>
        );
    }

    // Form state
    return (
        <>
            <div className="text-center md:text-left">
                <h3 className="text-2xl font-bold text-white mb-1">Nova Senha 🔐</h3>
                <p className="text-zinc-400">Digite sua nova senha</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-2">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-2 text-zinc-300">
                        Nova Senha
                    </label>
                    <div className="relative">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={4}
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-4 pr-12 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-zinc-300">
                        Confirmar Nova Senha
                    </label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading || !password || !confirmPassword}
                    className="mt-2 w-full rounded-xl bg-green-600 py-4 font-bold text-white text-lg hover:bg-green-500 active:scale-[0.98] transition-all shadow-lg shadow-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Redefinindo...
                        </>
                    ) : (
                        <>
                            <Lock size={20} />
                            Redefinir Senha
                        </>
                    )}
                </button>
            </form>
        </>
    );
}

export default function ResetPasswordPage() {
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
                        Defina uma senha forte e segura para proteger sua conta.
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

                    <Suspense fallback={
                        <div className="text-center space-y-4">
                            <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto"></div>
                            <p className="text-zinc-400">Carregando...</p>
                        </div>
                    }>
                        <ResetPasswordForm />
                    </Suspense>

                    {/* Footer */}
                    <div className="text-center text-xs text-zinc-600 pt-4">
                        © 2026 Zap Entregas • Feito com 💚 no Brasil
                    </div>
                </div>
            </div>
        </div>
    );
}
