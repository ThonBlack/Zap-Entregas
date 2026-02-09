import { db } from "@/db";
import { masterProducts, masterEvents, users } from "@/db/schema";
import { eq, desc, gte, count } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    LayoutDashboard, Package, TrendingUp, Users, DollarSign,
    AlertCircle, ArrowLeft, Plus, Smartphone, ShoppingCart,
    Globe, Monitor, Zap, Bell
} from "lucide-react";

const productTypeIcons: Record<string, any> = {
    saas: Globe,
    playstore: Smartphone,
    ecommerce: ShoppingCart,
    standalone: Package,
    desktop: Monitor,
};

const productTypeLabels: Record<string, string> = {
    saas: "SaaS Web",
    playstore: "Play Store",
    ecommerce: "E-commerce",
    standalone: "App Avulso",
    desktop: "Desktop",
};

export default async function MasterDashboardPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
    });

    if (currentUser?.role !== "admin") {
        redirect("/");
    }

    // Buscar produtos
    const products = await db.select().from(masterProducts).orderBy(desc(masterProducts.createdAt));

    // Calcular estatísticas dos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDateStr = thirtyDaysAgo.toISOString();

    const recentEvents = await db.select()
        .from(masterEvents)
        .where(gte(masterEvents.createdAt, startDateStr))
        .orderBy(desc(masterEvents.createdAt));

    // Calcular totais
    let totalRevenue = 0;
    let totalSignups = 0;
    let totalPurchases = 0;
    let totalCancellations = 0;

    for (const event of recentEvents) {
        switch (event.event) {
            case "signup": totalSignups++; break;
            case "purchase":
                totalPurchases++;
                totalRevenue += event.amount || 0;
                break;
            case "cancel": totalCancellations++; break;
        }
    }

    // Últimos 10 eventos
    const latestEvents = recentEvents.slice(0, 10);

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            {/* Header */}
            <header className="bg-gradient-to-r from-purple-900 to-indigo-900 border-b border-purple-700 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="p-2 text-purple-300 hover:text-white rounded-lg hover:bg-purple-800/50 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                                <LayoutDashboard className="text-white" size={22} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Dashboard Mestre</h1>
                                <p className="text-xs text-purple-300">Gestão Multi-Produto</p>
                            </div>
                        </div>
                    </div>
                    <Link
                        href="/admin/master/products/new"
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                    >
                        <Plus size={18} />
                        Novo Produto
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4 bg-zinc-800 border-zinc-700">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center">
                                <DollarSign className="text-green-400" size={24} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">
                                    R$ {totalRevenue.toFixed(2).replace('.', ',')}
                                </p>
                                <p className="text-xs text-zinc-500">Faturamento 30d</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 bg-zinc-800 border-zinc-700">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                                <Users className="text-blue-400" size={24} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{totalSignups}</p>
                                <p className="text-xs text-zinc-500">Novos Usuários</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 bg-zinc-800 border-zinc-700">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center">
                                <TrendingUp className="text-purple-400" size={24} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{totalPurchases}</p>
                                <p className="text-xs text-zinc-500">Compras</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 bg-zinc-800 border-zinc-700">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center">
                                <AlertCircle className="text-red-400" size={24} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{totalCancellations}</p>
                                <p className="text-xs text-zinc-500">Cancelamentos</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Produtos Grid */}
                <div>
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Package size={20} className="text-purple-400" />
                        Meus Produtos ({products.length})
                    </h2>

                    {products.length === 0 ? (
                        <Card className="p-8 bg-zinc-800 border-zinc-700 text-center">
                            <div className="w-16 h-16 bg-zinc-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Package className="text-zinc-500" size={32} />
                            </div>
                            <h3 className="text-white font-bold mb-2">Nenhum produto cadastrado</h3>
                            <p className="text-zinc-500 text-sm mb-4">
                                Adicione seu primeiro produto para começar a rastrear métricas.
                            </p>
                            <Link
                                href="/admin/master/products/new"
                                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                            >
                                <Plus size={18} />
                                Adicionar Produto
                            </Link>
                        </Card>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {products.map((product) => {
                                const Icon = productTypeIcons[product.type] || Package;
                                return (
                                    <Card key={product.id} className="p-4 bg-zinc-800 border-zinc-700 hover:border-purple-600/50 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <Icon className="text-purple-400" size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-white truncate">{product.name}</h3>
                                                    <Badge className={`text-xs ${product.isActive ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                                                        {product.isActive ? 'Ativo' : 'Inativo'}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-zinc-500 mb-2">
                                                    {productTypeLabels[product.type]}
                                                </p>
                                                <code className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded block truncate">
                                                    {product.apiKey.substring(0, 30)}...
                                                </code>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Últimos Eventos */}
                <div>
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Zap size={20} className="text-yellow-400" />
                        Últimos Eventos
                    </h2>

                    {latestEvents.length === 0 ? (
                        <Card className="p-6 bg-zinc-800 border-zinc-700 text-center">
                            <p className="text-zinc-500">Nenhum evento registrado ainda.</p>
                        </Card>
                    ) : (
                        <Card className="bg-zinc-800 border-zinc-700 overflow-hidden">
                            <div className="divide-y divide-zinc-700">
                                {latestEvents.map((event) => (
                                    <div key={event.id} className="p-4 flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${event.event === 'purchase' ? 'bg-green-600/20' :
                                            event.event === 'signup' ? 'bg-blue-600/20' :
                                                event.event === 'cancel' ? 'bg-red-600/20' : 'bg-zinc-700'
                                            }`}>
                                            {event.event === 'purchase' && <DollarSign className="text-green-400" size={18} />}
                                            {event.event === 'signup' && <Users className="text-blue-400" size={18} />}
                                            {event.event === 'cancel' && <AlertCircle className="text-red-400" size={18} />}
                                            {!['purchase', 'signup', 'cancel'].includes(event.event) && <Zap className="text-zinc-400" size={18} />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white text-sm font-medium capitalize">{event.event}</p>
                                            <p className="text-zinc-500 text-xs">
                                                {event.userId ? `Usuário: ${event.userId}` : 'Evento do sistema'}
                                            </p>
                                        </div>
                                        {event.amount && (
                                            <span className="text-green-400 font-bold">
                                                R$ {event.amount.toFixed(2).replace('.', ',')}
                                            </span>
                                        )}
                                        <span className="text-zinc-600 text-xs">
                                            {new Date(event.createdAt!).toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}
