import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save, Send, KeyRound, AlertTriangle } from "lucide-react";
import { updateMotoboyAction, generateInviteAction, resetMotoboyAccessAction } from "@/app/actions/motoboy";
import { requireShopkeeper } from "@/lib/session";
import { carregarMotoboyGerenciado } from "@/lib/team";
import { hasPendingInvite } from "@/lib/invite";

export default async function EditMotoboyPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ erro?: string }>;
}) {
    const me = await requireShopkeeper();
    const { id } = await params;
    const { erro } = await searchParams;

    // Motoboy de outra loja é tratado como inexistente — nem confirma que o id existe.
    const motoboy = await carregarMotoboyGerenciado(me, Number(id));
    if (!motoboy) notFound();

    const inativo = motoboy.isActive === false;

    return (
        <div className="min-h-screen bg-zinc-50 pb-20">
            <header className="bg-white border-b border-zinc-200 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-sm">
                <Link href="/motoboys" className="text-zinc-500 hover:text-zinc-900">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2 flex-wrap">
                    Editar {motoboy.name}
                    {inativo && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-200 text-zinc-700 border border-zinc-300">
                            Desativado
                        </span>
                    )}
                </h1>
            </header>

            <main className="max-w-xl mx-auto p-6 space-y-6">
                {erro && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-2 text-sm">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <span>{erro}</span>
                    </div>
                )}

                {inativo && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm">
                        Este motoboy está <strong>desativado</strong>: ele não entra mais no app e
                        não aparece na lista da equipe. O extrato e a dívida dele continuam
                        guardados — dá pra reativar na tela da equipe, em &ldquo;Mostrar desativados&rdquo;.
                    </div>
                )}

                <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
                    <form action={updateMotoboyAction} className="space-y-4">
                        <input type="hidden" name="id" value={motoboy.id} />

                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Nome</label>
                            <input
                                type="text"
                                name="name"
                                defaultValue={motoboy.name}
                                className="w-full p-3 bg-zinc-50 text-zinc-900 placeholder-zinc-400 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Nova Foto (Opcional)</label>
                            <input
                                type="file"
                                name="avatar"
                                accept="image/*"
                                className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                            />
                            <p className="text-xs text-zinc-400 mt-1">Selecione para trocar. Regra: a cada 30 dias.</p>
                        </div>

                        {/* Preview */}
                        {motoboy.avatarUrl && (
                            <div className="flex justify-center py-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={motoboy.avatarUrl} alt="Preview" className="w-24 h-24 rounded-full object-cover border-4 border-zinc-100 shadow-sm" />
                            </div>
                        )}

                        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                            <Save size={20} />
                            Salvar Alterações
                        </button>
                    </form>
                </div>

                {/* Acesso do motoboy — o link que deixa ele criar a senha dele */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200 space-y-3">
                    <h2 className="font-bold text-zinc-900">Acesso ao aplicativo</h2>
                    <p className="text-sm text-zinc-600">
                        {hasPendingInvite(motoboy)
                            ? "Há um convite valendo. Abra pra mandar de novo no WhatsApp ou copiar o link."
                            : motoboy.password
                                ? "Ele já tem senha. Se esqueceu ou trocou de celular, gere um convite novo pra ele definir outra."
                                : "Ele ainda não tem senha. Gere um convite pra ele criar a dele."}
                    </p>

                    {hasPendingInvite(motoboy) ? (
                        <Link
                            href={`/motoboys/${motoboy.id}/convite`}
                            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-3 rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                            <Send size={18} />
                            Ver convite
                        </Link>
                    ) : (
                        <form action={generateInviteAction}>
                            <input type="hidden" name="id" value={motoboy.id} />
                            <button
                                type="submit"
                                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors"
                            >
                                <Send size={18} />
                                Gerar novo convite
                            </button>
                        </form>
                    )}

                    {/*
                        Ninguém neste app tem e-mail cadastrado e não há servidor de e-mail:
                        "esqueci a senha" não tem como chegar em lugar nenhum. Quem redefine
                        é a loja, aqui: apaga a senha atual e manda um convite novo.
                    */}
                    {motoboy.password && (
                        <form action={resetMotoboyAccessAction} className="pt-3 border-t border-zinc-100">
                            <input type="hidden" name="id" value={motoboy.id} />
                            <button
                                type="submit"
                                className="w-full flex items-center justify-center gap-2 bg-white border border-zinc-300 text-zinc-700 font-semibold py-3 rounded-lg hover:bg-zinc-50 transition-colors"
                            >
                                <KeyRound size={18} />
                                Redefinir acesso (apaga a senha e gera convite)
                            </button>
                            <p className="text-xs text-zinc-500 mt-2">
                                Use quando ele esquecer a senha. A senha atual deixa de valer na hora.
                            </p>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
