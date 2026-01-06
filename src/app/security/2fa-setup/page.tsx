"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { generateTwoFactorSecretAction, enableTwoFactorAction } from "@/app/actions/auth";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function TwoFactorSetupPage() {
    const [secret, setSecret] = useState("");
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        generateTwoFactorSecretAction().then(async (res) => {
            if (res.secret && res.otpauth) {
                setSecret(res.secret);
                const url = await QRCode.toDataURL(res.otpauth);
                setQrCodeUrl(url);
            }
            setLoading(false);
        });
    }, []);

    const handleEnable = async () => {
        if (code.length < 6) return setError("Código incompleto");

        const res = await enableTwoFactorAction(code, secret);
        if (res?.success) {
            setSuccess(true);
        } else {
            setError(res?.error || "Erro ao ativar");
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-900 mb-2">2FA Ativado!</h2>
                    <p className="text-zinc-500 mb-8">Sua conta está agora mais segura. Você precisará do código a cada novo login.</p>
                    <Link href="/" className="block w-full bg-zinc-900 text-white font-bold py-3 rounded-xl hover:bg-zinc-800 transition-colors">
                        Voltar ao Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 p-6">
            <div className="max-w-xl mx-auto">
                <header className="mb-8 flex items-center gap-4">
                    <Link href="/" className="p-2 bg-white rounded-full shadow-sm hover:bg-zinc-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-zinc-600" />
                    </Link>
                    <h1 className="text-2xl font-bold text-zinc-900">Configurar Autenticação em 2 Etapas</h1>
                </header>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                    <div className="flex items-start gap-4 mb-8 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
                        <p className="text-sm text-blue-800 leading-relaxed">
                            A autenticação de dois fatores (2FA) adiciona uma camada extra de segurança.
                            Você precisará de um aplicativo como Google Authenticator ou Authy.
                        </p>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-zinc-400 animate-pulse">Gerando segredo...</div>
                    ) : (
                        <div className="space-y-8">
                            <div className="text-center space-y-4">
                                <p className="font-medium text-zinc-900">1. Escaneie este QR Code no seu app:</p>
                                {qrCodeUrl && (
                                    <div className="inline-block p-4 border border-zinc-100 rounded-xl shadow-sm">
                                        <img src={qrCodeUrl} alt="QR Code 2FA" className="w-48 h-48" />
                                    </div>
                                )}
                                <p className="text-xs text-zinc-500 font-mono select-all bg-zinc-100 py-2 px-4 rounded md:inline-block">
                                    Segredo: {secret}
                                </p>
                            </div>

                            <div className="border-t border-zinc-100 pt-8">
                                <p className="font-medium text-zinc-900 mb-4 text-center">2. Digite o código gerado para confirmar:</p>
                                <div className="flex flex-col gap-4 max-w-xs mx-auto">
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        placeholder="000 000"
                                        className="w-full text-center text-xl tracking-widest p-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                                    />
                                    {error && <div className="text-red-500 text-sm text-center font-medium">{error}</div>}
                                    <button
                                        onClick={handleEnable}
                                        className="w-full bg-zinc-900 text-white font-bold py-3 rounded-xl hover:bg-zinc-800 transition-all active:scale-[0.98]"
                                        disabled={code.length < 6}
                                    >
                                        Ativar 2FA
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
