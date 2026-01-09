import { db } from "@/db";
import { deliveries, users } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, DollarSign, ShieldCheck } from "lucide-react";

export default async function HistoryPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId)),
    });

    if (!user) redirect("/login");

    let history: any[] = [];

    if (user.role === 'admin') {
        history = await db.select()
            .from(deliveries)
            .where(eq(deliveries.status, 'delivered'))
            .orderBy(desc(deliveries.updatedAt));

    } else if (user.role === 'shopkeeper') {
        history = await db.select()
            .from(deliveries)
            .where(
                and(
                    eq(deliveries.shopkeeperId, user.id),
                    eq(deliveries.status, 'delivered')
                )
            )
            .orderBy(desc(deliveries.updatedAt));

    } else {
        const rawHistory = await db.select()
            .from(deliveries)
            .where(
                and(
                    eq(deliveries.motoboyId, user.id),
                    eq(deliveries.status, 'delivered')
                )
            )
            .orderBy(desc(deliveries.updatedAt));

        history = rawHistory.map(d => ({
            ...d,
            address: "🔒 Endereço Protegido (LGPD)",
            customerPhone: "🔒 (xx) xxxxx-xxxx",
            observation: "🔒 Dados Ocultos",
            customerName: d.customerName,
            stopOrder: d.stopOrder
        }));
    }

    return (
        <div className="min-h-screen bg-zinc-900 pb-20 md:pb-8">
            <header className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-md">
                <Link href="/" className="p-2 -ml-2 text-zinc-400 hover:text-green-400 rounded-full hover:bg-zinc-700 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-white">Histórico de Entregas</h1>
                    <p className="text-sm text-zinc-400">
                        {user.role === 'shopkeeper' ? 'Todas as entregas realizadas' : 'Suas entregas realizadas'}
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-4">
                {user.role === 'motoboy' && (
                    <div className="bg-green-900/30 border border-green-700 p-4 rounded-xl flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-green-400 mt-0.5" />
                        <div className="text-sm text-green-200">
                            <p className="font-bold">Privacidade Ativa</p>
                            <p>Para conformidade com a LGPD e segurança, dados de contato dos clientes são removidos do seu histórico após a conclusão da entrega.</p>
                        </div>
                    </div>
                )}

                {history.length === 0 ? (
                    <div className="text-center p-12 text-zinc-400 bg-zinc-800 rounded-2xl border border-zinc-700">
                        Nenhuma entrega no histórico.
                    </div>
                ) : (
                    history.map(item => (
                        <div key={item.id} className="bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-700 flex flex-col md:flex-row justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold uppercase rounded-full">
                                        Entregue
                                    </span>
                                    <span className="text-zinc-400 text-xs">
                                        {new Date(item.updatedAt || "").toLocaleString('pt-BR')}
                                    </span>
                                </div>
                                <h3 className="font-bold text-white text-lg">
                                    {item.customerName || "Cliente"}
                                    {item.stopOrder && (
                                        <span className="ml-2 text-xs font-normal text-zinc-400 bg-zinc-700 px-2 py-0.5 rounded-full border border-zinc-600">
                                            Parada #{item.stopOrder}
                                        </span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-2 text-zinc-300">
                                    <MapPin size={16} className="text-green-400" />
                                    <span className={user.role === 'motoboy' ? "italic text-zinc-500" : ""}>
                                        {item.address}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col items-end justify-center min-w-[100px] border-t md:border-t-0 md:border-l border-zinc-700 pt-4 md:pt-0 md:pl-6 mt-2 md:mt-0">
                                <span className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Valor</span>
                                <div className="flex items-center gap-1 text-xl font-bold text-white">
                                    <DollarSign size={20} className="text-green-400" />
                                    {item.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </main>
        </div>
    );
}
