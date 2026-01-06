"use client";

import { verifyTwoFactorAction } from "@/app/actions/auth";
import { useState } from "react";

export default function TwoFactorVerifyPage() {
    const [error, setError] = useState("");

    const handleSubmit = async (formData: FormData) => {
        const code = formData.get("code") as string;
        if (code.length < 6) {
            setError("Código deve ter 6 dígitos");
            return;
        }

        const res = await verifyTwoFactorAction(code);
        if (res?.error) {
            setError(res.error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-900 px-4">
            <div className="bg-zinc-800 p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
                <div className="mb-6">
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-green-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Verificação em Duas Etapas</h1>
                    <p className="text-zinc-400 text-sm">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
                </div>

                <form action={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        name="code"
                        placeholder="000 000"
                        maxLength={6}
                        className="w-full text-center text-2xl tracking-widest bg-zinc-700/50 border border-zinc-600 rounded-xl py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                        autoFocus
                    />

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98]"
                    >
                        Verificar
                    </button>
                </form>
            </div>
        </div>
    );
}
