import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, KeyRound, MessageCircle } from "lucide-react";

/**
 * "Esqueci minha senha" — a versão honesta.
 *
 * A tela antiga pedia telefone ou e-mail e respondia "verifique seu e-mail".
 * Só que ninguém neste app tem e-mail cadastrado e não há servidor de e-mail
 * configurado: o link nunca chegava em lugar nenhum e a pessoa ficava esperando.
 *
 * Quem resolve de verdade é a loja, na ficha do motoboy ("Redefinir acesso"):
 * ela apaga a senha e manda um convite novo, o mesmo link do primeiro acesso.
 */
export default function ForgotPasswordPage() {
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
                        Esqueceu a senha? Quem destrava é a sua loja.
                    </p>
                </div>
            </div>

            {/* Conteúdo (direita) */}
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

                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Voltar ao login
                    </Link>

                    <div>
                        <h3 className="text-2xl font-bold text-white mb-1">Esqueceu sua senha? 🔐</h3>
                        <p className="text-zinc-400">
                            Este app não manda e-mail de recuperação — ninguém aqui cadastra e-mail.
                            A senha é destravada pela loja.
                        </p>
                    </div>

                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 space-y-4">
                        <div className="flex items-start gap-3">
                            <MessageCircle size={20} className="text-green-400 shrink-0 mt-0.5" />
                            <div className="text-sm text-zinc-300">
                                <strong className="block text-white mb-1">Motoboy</strong>
                                Chame a loja no WhatsApp e peça um <strong>novo convite</strong>. Ela
                                abre sua ficha na equipe e clica em &ldquo;Redefinir acesso&rdquo;.
                                Você recebe um link, cria uma senha nova e já entra.
                            </div>
                        </div>

                        <div className="flex items-start gap-3 border-t border-zinc-700 pt-4">
                            <KeyRound size={20} className="text-green-400 shrink-0 mt-0.5" />
                            <div className="text-sm text-zinc-300">
                                <strong className="block text-white mb-1">Dono da loja</strong>
                                Fale com o administrador do sistema pra redefinir seu acesso.
                            </div>
                        </div>
                    </div>

                    <p className="text-sm text-zinc-500">
                        Se você ainda consegue entrar, troque a senha por dentro do app:
                        Configurações → Trocar senha.
                    </p>

                    <Link
                        href="/login"
                        className="block w-full rounded-xl bg-zinc-700 py-4 font-bold text-white text-lg text-center hover:bg-zinc-600 transition-all"
                    >
                        Voltar ao Login
                    </Link>

                    <div className="text-center text-xs text-zinc-600 pt-4">
                        © 2026 Zap Entregas • Feito com 💚 no Brasil
                    </div>
                </div>
            </div>
        </div>
    );
}
