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

    // Fetch delivered items
    // If shopkeeper, fetch all created by him.
    // If motoboy, fetch all assigned/delivered by him.
    let history: any[] = [];

    if (user.role === 'admin') {
        // Admin sees ALL delivered history
        history = await db.select()
            .from(deliveries)
            .where(eq(deliveries.status, 'delivered'))
            .orderBy(desc(deliveries.updatedAt));

    } else if (user.role === 'shopkeeper') {
        // Shopkeeper sees only their own delivered history
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

        // MASK DATA for Motoboy: Hide strictly sensitive location/contact info.
        // Keep Customer Name (for reference) and finance values.
        history = rawHistory.map(d => ({
            ...d,
            address: "🔒 Endereço Protegido (LGPD)",
            customerPhone: "🔒 (xx) xxxxx-xxxx",
            observation: "🔒 Dados Ocultos",
            // Explicitly ensure other fields are passed through
            customerName: d.customerName,
            stopOrder: d.stopOrder
        }));
    }

    return (
        <div className="min-h-screen bg-zinc-50 p-6 space-y-6">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 bg-white rounded-full shadow-sm hover:bg-zinc-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-zinc-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">Histórico de Entregas</h1>
                        <p className="text-sm text-zinc-500">
                            {user.role === 'shopkeeper' ? 'Todas as entregas realizadas' : 'Suas entregas realizadas'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-4">
                {user.role === 'motoboy' && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-bold">Privacidade Ativa</p>
                            <p>Para conformidade com a LGPD e segurança, dados de contato dos clientes são removidos do seu histórico após a conclusão da entrega.</p>
                        </div>
                    </div>
                )}

                {history.length === 0 ? (
                    <div className="text-center p-12 text-zinc-400 bg-white rounded-2xl border border-zinc-100">
                        Nenhuma entrega no histórico.
                    </div>
                ) : (
                    history.map(item => (
                        <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 flex flex-col md:flex-row justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold uppercase rounded-full">
                                        Entregue
                                    </span>
                                    <span className="text-zinc-400 text-xs">
                                        {new Date(item.updatedAt || "").toLocaleString('pt-BR')}
                                    </span>
                                </div>
                                <h3 className="font-bold text-zinc-900 text-lg">
                                    {item.customerName || "Cliente"}
                                    {item.stopOrder && (
                                        <span className="ml-2 text-xs font-normal text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                                            Parada #{item.stopOrder}
                                        </span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-2 text-zinc-600">
                                    <MapPin size={16} />
                                    <span className={user.role === 'motoboy' ? "italic text-zinc-400" : ""}>
                                        {item.address}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col items-end justify-center min-w-[100px] border-t md:border-t-0 md:border-l border-zinc-50 pt-4 md:pt-0 md:pl-6 mt-2 md:mt-0">
                                <span className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Valor</span>
                                <div className="flex items-center gap-1 text-xl font-bold text-zinc-900">
                                    <DollarSign size={20} className="text-emerald-600" />
                                    {item.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
