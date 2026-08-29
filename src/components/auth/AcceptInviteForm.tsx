"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Download, Eye, EyeOff, Lock, Smartphone } from "lucide-react";
import { acceptInviteAction } from "@/app/actions/invite";

interface AcceptInviteFormProps {
    token: string;
    /** Só o primeiro nome — esta página é pública, não vaza o resto do cadastro. */
    primeiroNome: string;
    apkUrl: string;
}

/** A página já está sendo aberta de dentro do app (instalado como PWA ou pelo TWA)? */
function estaNoApp(): boolean {
    return (
        window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
        // iOS antigo
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        // aberto de dentro do app Android (TWA)
        document.referrer.startsWith("android-app://")
    );
}

/** Não muda enquanto a tela estiver aberta — nada pra assinar. */
const semInscricao = () => () => { };

export default function AcceptInviteForm({ token, primeiroNome, apkUrl }: AcceptInviteFormProps) {
    const router = useRouter();
    const [senha, setSenha] = useState("");
    const [confirma, setConfirma] = useState("");
    const [mostrar, setMostrar] = useState(false);
    const [erro, setErro] = useState("");
    const [enviando, setEnviando] = useState(false);
    // No servidor não dá pra saber: devolve false até o navegador responder.
    const noApp = useSyncExternalStore(semInscricao, estaNoApp, () => false);

    async function enviar(e: React.FormEvent) {
        e.preventDefault();
        setErro("");

        if (senha.length < 8) {
            setErro("A senha precisa ter pelo menos 8 caracteres.");
            return;
        }
        if (senha !== confirma) {
            setErro("As duas senhas não são iguais.");
            return;
        }

        setEnviando(true);
        try {
            const r = await acceptInviteAction(token, senha);
            if (r.success) {
                router.replace("/app");
                router.refresh();
                return;
            }
            setErro(r.error || "Não deu pra salvar a senha. Tente de novo.");
        } catch {
            setErro("Não deu pra salvar a senha. Tente de novo.");
        }
        setEnviando(false);
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white">Bem-vindo, {primeiroNome}! 👋</h2>
                <p className="text-zinc-400 mt-1">Faltam dois passos e você já começa a receber corridas.</p>
            </div>

            {/* Passo 1 — o aplicativo */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                    <h3 className="font-bold text-white">Instalar o aplicativo</h3>
                </div>

                {noApp ? (
                    <p className="text-sm text-green-400 flex items-center gap-2">
                        <Smartphone size={16} />
                        Você já está dentro do app. Pode ir direto pro passo 2.
                    </p>
                ) : (
                    <>
                        <p className="text-sm text-zinc-400">
                            Baixe o app no seu celular Android. Se o celular perguntar, confirme a
                            instalação — o arquivo é o nosso.
                        </p>
                        <a
                            href={apkUrl}
                            className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-3 rounded-lg transition-colors"
                        >
                            <Download size={18} />
                            Baixar o app
                        </a>
                        <p className="text-xs text-zinc-500">
                            Já instalou? Pode continuar por aqui mesmo — a senha vale nos dois.
                        </p>
                    </>
                )}
            </div>

            {/* Passo 2 — a senha */}
            <form onSubmit={enviar} className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                    <h3 className="font-bold text-white">Criar sua senha</h3>
                </div>

                {erro && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm">
                        <AlertCircle size={18} />
                        {erro}
                    </div>
                )}

                <div>
                    <label htmlFor="senha" className="block text-sm font-medium mb-1 text-zinc-300">
                        Senha (mínimo 8 caracteres)
                    </label>
                    <div className="relative">
                        <input
                            id="senha"
                            type={mostrar ? "text" : "password"}
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            minLength={8}
                            required
                            autoComplete="new-password"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 pr-12 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setMostrar(!mostrar)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            aria-label={mostrar ? "Esconder senha" : "Mostrar senha"}
                        >
                            {mostrar ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                <div>
                    <label htmlFor="confirma" className="block text-sm font-medium mb-1 text-zinc-300">
                        Repita a senha
                    </label>
                    <input
                        id="confirma"
                        type={mostrar ? "text" : "password"}
                        value={confirma}
                        onChange={(e) => setConfirma(e.target.value)}
                        required
                        autoComplete="new-password"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={enviando || !senha || !confirma}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
                >
                    {enviando ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Salvando...
                        </>
                    ) : (
                        <>
                            <Lock size={18} />
                            Salvar e entrar
                        </>
                    )}
                </button>

                <p className="text-xs text-zinc-500 text-center">
                    Depois disso é só entrar com seu telefone e essa senha.
                </p>
            </form>
        </div>
    );
}
