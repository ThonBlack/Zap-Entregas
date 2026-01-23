import { db } from "@/db";
import { plans, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit2, Save, X, Check, Power } from "lucide-react";
import { updatePlanAction, togglePlanStatusAction } from "@/app/actions/admin-plans";

export default async function PlansPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
    });

    if (currentUser?.role !== "admin") {
        redirect("/");
    }

    const allPlans = await db.select().from(plans).orderBy(plans.price);

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            {/* Header */}
            <header className="bg-gradient-to-r from-green-900 to-emerald-900 border-b border-green-700 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex items-center gap-4">
                    <Link href="/admin" className="p-2 text-green-300 hover:text-white rounded-lg hover:bg-green-800/50 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">Gerenciar Planos</h1>
                        <p className="text-green-300 text-sm">Configure preços e limites</p>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allPlans.map((plan) => (
                        <Card key={plan.id} className="bg-zinc-800 border-zinc-700 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-zinc-700 flex justify-between items-center bg-zinc-900/50">
                                <h2 className="text-xl font-bold text-white capitalize">{plan.name}</h2>
                                <form action={async () => {
                                    "use server";
                                    await togglePlanStatusAction(plan.id, plan.isActive || false);
                                }}>
                                    <button
                                        type="submit"
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors flex items-center gap-1 ${plan.isActive
                                                ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                                                : "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                                            }`}
                                    >
                                        <Power size={12} />
                                        {plan.isActive ? "Ativo" : "Inativo"}
                                    </button>
                                </form>
                            </div>

                            <div className="p-6 flex-1">
                                <form action={updatePlanAction.bind(null, plan.id)} className="space-y-4">
                                    {/* Price */}
                                    <div>
                                        <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Preço (R$)</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-zinc-600">R$</span>
                                            <input
                                                type="number"
                                                name="price"
                                                step="0.01"
                                                defaultValue={plan.price}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white font-bold focus:ring-2 focus:ring-green-600 focus:border-transparent outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Limits */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Motoboys</label>
                                            <input
                                                type="number"
                                                name="maxMotoboys"
                                                defaultValue={plan.maxMotoboys || 0}
                                                className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-600 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Entregas</label>
                                            <input
                                                type="number"
                                                name="maxDeliveries"
                                                defaultValue={plan.maxDeliveries || 0}
                                                className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-600 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Extra Cost */}
                                    <div>
                                        <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Preço por Extra (R$)</label>
                                        <input
                                            type="number"
                                            name="pricePerExtraDelivery"
                                            step="0.01"
                                            defaultValue={plan.pricePerExtraDelivery || 0}
                                            className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-green-600 outline-none"
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-zinc-700/50 flex justify-end">
                                        <button
                                            type="submit"
                                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                            <Save size={16} />
                                            Salvar Alterações
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </Card>
                    ))}
                </div>
            </main>
        </div>
    );
}
