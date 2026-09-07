import Link from "next/link";

/**
 * Página que aparece quando o endereço não existe (ou o link de rastreio já
 * foi apagado). Antes caía na tela padrão do Next: fundo branco, texto em
 * inglês, sem jeito de voltar. Quem mais vê essa tela é o CLIENTE FINAL, com
 * um link velho que o motoboy mandou no WhatsApp.
 */
export default function NotFound() {
    return (
        <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center p-6">
            <div className="max-w-sm w-full text-center space-y-4">
                <div className="text-5xl" aria-hidden="true">🔎</div>
                <h1 className="text-2xl font-bold text-white">Página não encontrada</h1>
                <p className="text-zinc-400 text-sm leading-relaxed">
                    Esse endereço não existe mais. Se era um link de rastreio, o pedido
                    provavelmente já foi entregue — fale com a loja pra confirmar.
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center justify-center min-h-11 px-6 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors"
                >
                    Voltar pro início
                </Link>
            </div>
        </div>
    );
}
