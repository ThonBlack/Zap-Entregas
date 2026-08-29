import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ArrowLeft, Save, Send } from "lucide-react";
import { updateMotoboyAction, generateInviteAction } from "@/app/actions/motoboy";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { hasPendingInvite } from "@/lib/invite";

export default async function EditMotoboyPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userId = await getSessionUserId();
    if (!userId) redirect("/login");

    const motoboy = await db.query.users.findFirst({
        where: eq(users.id, Number(id))
    });

    if (!motoboy) return <div>Motoboy não encontrado</div>;

    return (
        <div className="min-h-screen bg-zinc-50 pb-20">
            <header className="bg-white border-b border-zinc-200 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-sm">
                <Link href="/motoboys" className="text-zinc-500 hover:text-zinc-900">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-bold text-zinc-900">Editar {motoboy.name}</h1>
            </header>

            <main className="max-w-xl mx-auto p-6 space-y-6">
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
                </div>
            </main>
        </div>
    );
}
