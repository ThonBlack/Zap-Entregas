import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, RefreshCw, Send } from "lucide-react";

import { requireShopkeeper } from "@/lib/session";
import { generateInviteAction } from "@/app/actions/motoboy";
import {
    APK_URL,
    buildInviteMessage,
    buildInviteUrl,
    buildWhatsappUrl,
    hasPendingInvite,
    phoneToWhatsapp,
} from "@/lib/invite";
import InviteReadyCard from "@/components/motoboys/InviteReadyCard";

/**
 * "Convite pronto" — o que o dono da loja vê depois de cadastrar o motoboy.
 *
 * A conta nasce sem senha, então esta tela é o único jeito do motoboy entrar:
 * link de uso único que ele abre pra criar a senha dele.
 */
export default async function ConviteProntoPage({ params }: { params: Promise<{ id: string }> }) {
    const dono = await requireShopkeeper();
    const { id } = await params;

    const motoboy = await db.query.users.findFirst({
        where: eq(users.id, Number(id)),
    });

    if (!motoboy || motoboy.role !== "motoboy") {
        return (
            <Moldura>
                <p className="text-zinc-400">Motoboy não encontrado.</p>
            </Moldura>
        );
    }

    const valendo = hasPendingInvite(motoboy);
    const inviteUrl = motoboy.inviteToken ? buildInviteUrl(motoboy.inviteToken) : "";
    const mensagem = valendo ? buildInviteMessage(motoboy.name, dono.name, inviteUrl) : "";

    return (
        <Moldura>
            {valendo ? (
                <>
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 space-y-4">
                        <div className="flex items-center gap-2 text-green-400">
                            <CheckCircle2 size={22} />
                            <h2 className="font-bold text-lg">Convite pronto</h2>
                        </div>

                        <p className="text-sm text-zinc-300">
                            <strong className="text-white">{motoboy.name}</strong> ainda não tem senha.
                            Mande o link abaixo pra ele — é lá que ele baixa o app e cria a senha dele.
                            O link vale por 7 dias e some depois de usado.
                        </p>

                        <InviteReadyCard
                            inviteUrl={inviteUrl}
                            whatsappUrl={buildWhatsappUrl(motoboy.phone, mensagem)}
                            temTelefone={!!phoneToWhatsapp(motoboy.phone)}
                        />
                    </div>

                    <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 space-y-2">
                        <h3 className="text-sm font-semibold text-zinc-300">O que vai na mensagem</h3>
                        <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-sans">{mensagem}</pre>
                        <p className="text-xs text-zinc-500">
                            App Android: <span className="break-all">{APK_URL}</span>
                        </p>
                    </div>
                </>
            ) : (
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 space-y-4">
                    <h2 className="font-bold text-lg text-white">
                        {motoboy.inviteToken ? "Convite vencido" : "Sem convite ativo"}
                    </h2>
                    <p className="text-sm text-zinc-400">
                        {motoboy.inviteToken
                            ? "O link anterior passou dos 7 dias. Gere um novo pra mandar pro motoboy."
                            : "Este motoboy já usou o convite (ou nunca teve um). Se ele precisar entrar de novo, gere um convite novo — isso deixa ele definir uma senha nova."}
                    </p>
                    <form action={generateInviteAction}>
                        <input type="hidden" name="id" value={motoboy.id} />
                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors"
                        >
                            <RefreshCw size={18} />
                            Gerar novo convite
                        </button>
                    </form>
                </div>
            )}

            {valendo && (
                <form action={generateInviteAction}>
                    <input type="hidden" name="id" value={motoboy.id} />
                    <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 text-zinc-400 hover:text-white text-sm py-2 transition-colors"
                    >
                        <RefreshCw size={16} />
                        Gerar outro link (invalida este)
                    </button>
                </form>
            )}
        </Moldura>
    );
}

function Moldura({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-md">
                <Link href="/motoboys" className="text-zinc-400 hover:text-green-400 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div className="flex items-center gap-2">
                    <Send size={20} className="text-green-400" />
                    <h1 className="text-xl font-bold text-white">Convite do motoboy</h1>
                </div>
            </header>
            <main className="max-w-xl mx-auto p-6 space-y-6">{children}</main>
        </div>
    );
}
