import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ArrowLeft, Plus, Edit2, User, Trash2, Users, Wallet, Send } from "lucide-react";
import { createMotoboyAction, deleteMotoboyAction } from "@/app/actions/motoboy";
import { requireShopkeeper } from "@/lib/session";
import { getBalances, formatBRL } from "@/lib/wallet";
import { hasPendingInvite, isInviteExpired } from "@/lib/invite";

export default async function MotoboysPage() {
    await requireShopkeeper();

    const motoboys = await db.select().from(users).where(eq(users.role, 'motoboy')).orderBy(desc(users.createdAt));
    const balances = await getBalances(motoboys.map(m => m.id));

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-md">
                <Link href="/" className="text-zinc-400 hover:text-green-400 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div className="flex items-center gap-2">
                    <Users size={20} className="text-green-400" />
                    <h1 className="text-xl font-bold text-white">Minha Equipe</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-6 space-y-6">

                {/* Create New Motoboy Form */}
                <div className="bg-zinc-800 p-6 rounded-xl shadow-sm border border-zinc-700">
                    <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                        <Plus size={20} className="text-green-400" />
                        Cadastrar Novo Motoboy
                    </h2>
                    <form action={createMotoboyAction} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                name="name"
                                placeholder="Nome do Motoboy"
                                className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                required
                            />
                            <input
                                type="tel"
                                name="phone"
                                placeholder="Telefone (Login)"
                                className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">Foto do Perfil</label>
                                <input
                                    type="file"
                                    name="avatar"
                                    accept="image/*"
                                    className="w-full p-2 bg-zinc-700 border border-zinc-600 rounded-lg text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">Senha (opcional)</label>
                                <input
                                    type="text"
                                    name="password"
                                    placeholder="Deixe em branco"
                                    className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all text-sm"
                                />
                                <p className="text-xs text-zinc-400 mt-1">
                                    Em branco = o próprio motoboy cria a senha dele pelo link de convite
                                    que aparece na tela seguinte.
                                </p>
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors">
                            Cadastrar
                        </button>
                    </form>
                </div>

                <div className="space-y-4">
                    <h3 className="font-semibold text-zinc-400 text-sm uppercase tracking-wide">Motoboys Cadastrados</h3>
                    {motoboys.length === 0 ? (
                        <p className="text-zinc-500 text-center py-8 bg-zinc-800 rounded-xl border border-zinc-700">Nenhum motoboy na equipe ainda.</p>
                    ) : (
                        motoboys.map(motoboy => (
                            <div key={motoboy.id} className="bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-700 flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    {motoboy.avatarUrl ? (
                                        <img src={motoboy.avatarUrl} alt={motoboy.name} className="w-12 h-12 rounded-full object-cover border border-zinc-600" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400">
                                            <User size={24} />
                                        </div>
                                    )}
                                    <div>
                                        <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                                            {motoboy.name}
                                            {hasPendingInvite(motoboy) && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-900/40 text-amber-300 border border-amber-700/50">
                                                    Convite pendente
                                                </span>
                                            )}
                                            {motoboy.inviteToken && isInviteExpired(motoboy.inviteTokenExpiresAt) && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-900/40 text-red-300 border border-red-700/50">
                                                    Convite expirado
                                                </span>
                                            )}
                                            {!motoboy.inviteToken && !motoboy.password && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-700 text-zinc-300 border border-zinc-600">
                                                    Sem acesso
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-zinc-400">{motoboy.phone || "sem telefone"}</div>
                                        {(() => {
                                            const b = balances.get(motoboy.id) ?? 0;
                                            if (b > 0) return <div className="text-xs text-green-400 font-mono">a pagar {formatBRL(b)}</div>;
                                            if (b < 0) return <div className="text-xs text-red-400 font-mono">ele deve {formatBRL(-b)}</div>;
                                            return <div className="text-xs text-zinc-500 font-mono">saldo zerado</div>;
                                        })()}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Link
                                        href={`/motoboys/${motoboy.id}/convite`}
                                        className={`p-2 transition-colors bg-zinc-700 rounded-lg hover:bg-zinc-600 ${hasPendingInvite(motoboy) ? "text-amber-300 hover:text-amber-200" : "text-zinc-400 hover:text-green-400"}`}
                                        title={hasPendingInvite(motoboy) ? "Reenviar convite" : "Gerar convite"}
                                    >
                                        <Send size={20} />
                                    </Link>
                                    <Link href={`/motoboys/${motoboy.id}/financeiro`} className="p-2 text-zinc-400 hover:text-green-400 transition-colors bg-zinc-700 rounded-lg hover:bg-zinc-600" title="Financeiro">
                                        <Wallet size={20} />
                                    </Link>
                                    <Link href={`/motoboys/${motoboy.id}`} className="p-2 text-zinc-400 hover:text-green-400 transition-colors bg-zinc-700 rounded-lg hover:bg-zinc-600">
                                        <Edit2 size={20} />
                                    </Link>
                                    <form action={deleteMotoboyAction}>
                                        <input type="hidden" name="id" value={motoboy.id} />
                                        <button
                                            type="submit"
                                            className="p-2 text-zinc-400 hover:text-red-400 transition-colors bg-zinc-700 rounded-lg hover:bg-red-900/30"
                                            title="Excluir Motoboy"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
