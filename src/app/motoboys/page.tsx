import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ArrowLeft, Plus, Edit2, User } from "lucide-react";
import { createMotoboyAction, updateMotoboyAction } from "@/app/actions/motoboy"; // You'll need to create this or adjust import
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function MotoboysPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) redirect("/login");

    // Fetch motoboys
    const motoboys = await db.select().from(users).where(eq(users.role, 'motoboy')).orderBy(desc(users.createdAt));

    return (
        <div className="min-h-screen bg-zinc-50 pb-20">
            <header className="bg-white border-b border-zinc-200 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-sm">
                <Link href="/" className="text-zinc-500 hover:text-zinc-900">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-bold text-zinc-900">Minha Equipe</h1>
            </header>

            <main className="max-w-2xl mx-auto p-6 space-y-6">

                {/* Create New Motoboy Form (Simple/Inline for now or Modal logic via URL params if complex. Let's do simple collapsible or just a form card) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
                    <h2 className="font-bold text-zinc-800 mb-4 flex items-center gap-2">
                        <Plus size={20} className="text-green-600" />
                        Cadastrar Novo Motoboy
                    </h2>
                    <form action={createMotoboyAction} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                name="name"
                                placeholder="Nome do Motoboy"
                                className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                required
                            />
                            <input
                                type="tel"
                                name="phone"
                                placeholder="Telefone (Login)"
                                className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Foto do Perfil</label>
                                <input
                                    type="file"
                                    name="avatar"
                                    accept="image/*"
                                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                                />
                            </div>
                            <input
                                type="text"
                                name="password"
                                placeholder="Senha (Padrão: 123456)"
                                className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all text-sm"
                            />
                        </div>
                        <button type="submit" className="w-full bg-zinc-900 text-white font-bold py-3 rounded-lg hover:bg-zinc-800 transition-colors">
                            Cadastrar
                        </button>
                    </form>
                </div>

                <div className="space-y-4">
                    <h3 className="font-semibold text-zinc-500 text-sm uppercase tracking-wide">Motoboys Cadastrados</h3>
                    {motoboys.length === 0 ? (
                        <p className="text-zinc-400 text-center py-8">Nenhum motoboy na equipe ainda.</p>
                    ) : (
                        motoboys.map(motoboy => (
                            <div key={motoboy.id} className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    {motoboy.avatarUrl ? (
                                        <img src={motoboy.avatarUrl} alt={motoboy.name} className="w-12 h-12 rounded-full object-cover border border-zinc-100" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                                            <User size={24} />
                                        </div>
                                    )}
                                    <div>
                                        <div className="font-bold text-zinc-900">{motoboy.name}</div>
                                        <div className="text-sm text-zinc-500">{motoboy.phone}</div>
                                    </div>
                                </div>

                                {/* Edit Trigger - For now just a details/edit form that toggles? Or a separate edit page? 
                                    Let's keep it simple: Form below that populates? 
                                    Actually, let's use a details/summary or a link to edit page. 
                                    For MVP, let's just show a "Edit" button that opens a browser prompt or a dedicated edit route?
                                    Let's do a dedicated Edit route for simplicity: /motoboys/[id]
                                */}
                                <Link href={`/motoboys/${motoboy.id}`} className="p-2 text-zinc-400 hover:text-blue-600 transition-colors bg-zinc-50 rounded-lg hover:bg-blue-50">
                                    <Edit2 size={20} />
                                </Link>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
