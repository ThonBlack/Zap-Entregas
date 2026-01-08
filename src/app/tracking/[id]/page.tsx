import { db } from "@/db";
import { deliveries, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getMotoboyLocationAction } from "@/app/actions/tracking";

// Dynamic import for Map to avoid SSR issues with Leaflet
const TrackingMap = dynamic(() => import("@/components/TrackingMap"), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-zinc-100 rounded-xl animate-pulse mt-4"></div>
});

export default async function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch delivery
    const delivery = await db.query.deliveries.findFirst({
        where: eq(deliveries.id, Number(id)),
        with: {
            motoboy: true,
            shopkeeper: true
        }
    });

    if (!delivery) notFound();

    let motoboyLocation = null;

    if (delivery.motoboyId) {
        const result = await getMotoboyLocationAction(delivery.motoboyId);
        if (result && result.lat && result.lng) {
            motoboyLocation = { lat: result.lat, lng: result.lng };
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50">
            <header className="bg-white p-4 shadow-sm flex items-center gap-4">
                <div className="font-bold text-lg text-green-600">Zap Entregas</div>
                <div className="text-sm text-zinc-500">Rastreio de Pedido #{delivery.id}</div>
            </header>

            <main className="max-w-lg mx-auto p-4 space-y-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 className="font-bold text-xl text-zinc-900">
                                {delivery.status === 'pending' && "Aguardando Motoboy"}
                                {delivery.status === 'assigned' && "Motoboy a caminho"}
                                {delivery.status === 'picked_up' && "Saiu para entrega"}
                                {delivery.status === 'delivered' && "Entregue"}
                                {delivery.status === 'canceled' && "Cancelado"}
                            </h1>
                            <p className="text-zinc-500 text-sm">Previsão: 15-20 min</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                            ${delivery.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}
                        `}>
                            {delivery.status}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-zinc-200 font-bold text-zinc-700">
                                🏪
                            </div>
                            <div>
                                <div className="text-xs text-zinc-500">Loja</div>
                                <div className="font-medium">{delivery.shopkeeper?.name || "Loja Parceira"}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-zinc-200 font-bold text-zinc-700">
                                📍
                            </div>
                            <div>
                                <div className="text-xs text-zinc-500">Destino</div>
                                <div className="font-medium">{delivery.address}</div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        {delivery.motoboyId && motoboyLocation ? (
                            <TrackingMap motoboyLocation={motoboyLocation} />
                        ) : (
                            <div className="h-[200px] bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400 text-sm text-center p-4">
                                {delivery.motoboyId ? "Aguardando sinal do motoboy..." : "Aguardando um motoboy aceitar seu pedido."}
                            </div>
                        )}
                    </div>
                </div>

                {delivery.motoboy && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 flex items-center gap-4">
                        {delivery.motoboy.avatarUrl ? (
                            <img src={delivery.motoboy.avatarUrl} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                            <div className="w-12 h-12 bg-zinc-200 rounded-full"></div>
                        )}
                        <div>
                            <div className="font-bold text-zinc-900">{delivery.motoboy.name}</div>
                            <div className="text-sm text-zinc-500">Seu entregador</div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
