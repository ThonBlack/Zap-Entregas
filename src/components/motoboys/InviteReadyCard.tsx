"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

interface InviteReadyCardProps {
    inviteUrl: string;
    /** Link do WhatsApp já montado no servidor (telefone + mensagem pronta). */
    whatsappUrl: string;
    /** Avisa quando o telefone cadastrado não dá pra usar no WhatsApp. */
    temTelefone: boolean;
}

export default function InviteReadyCard({ inviteUrl, whatsappUrl, temTelefone }: InviteReadyCardProps) {
    const [copiado, setCopiado] = useState(false);

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            // Navegador sem permissão de área de transferência: o link está na tela.
        }
    };

    return (
        <div className="space-y-3">
            <code className="block bg-zinc-900/60 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 break-all">
                {inviteUrl}
            </code>

            <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors"
            >
                <MessageCircle size={20} />
                Enviar no WhatsApp
            </a>

            <button
                type="button"
                onClick={copiar}
                className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-medium py-3 rounded-lg transition-colors"
            >
                {copiado ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                {copiado ? "Link copiado!" : "Copiar link"}
            </button>

            {!temTelefone && (
                <p className="text-xs text-amber-400">
                    O telefone cadastrado não parece um celular válido — o WhatsApp vai abrir
                    sem destinatário, escolha o contato na mão.
                </p>
            )}
        </div>
    );
}
