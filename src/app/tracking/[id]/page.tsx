import { db } from "@/db";
import { deliveries, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { carregarLocalDoMotoboy } from "@/lib/motoboyLocation";
import TrackingMapWrapper from "@/components/map/TrackingMapWrapper";
import { getBrowserMapsKey } from "@/lib/mapsKey";
import AutoRefresh from "@/components/shared/AutoRefresh";
import { chargeModeDaCorrida } from "@/lib/chargeMode";
import { formatBRL } from "@/lib/wallet-shared";
import { rotuloCorrida } from "@/lib/dailySeq-shared";

export const metadata = { title: "Rastreio do pedido · Zap Entregas" };

// A página do cliente não pode congelar: o HTML do servidor vale 15s e o
// AutoRefresh abaixo pede dados novos a cada 20s enquanto a tela está à vista.
export const revalidate = 15;

// O cliente enxerga essa página: nada de status cru em inglês.
const STATUS_LABEL: Record<string, string> = {
    draft: "preparando",
    pending: "aguardando",
    assigned: "a caminho",
    picked_up: "em rota",
    delivered: "entregue",
    canceled: "cancelado",
};

export default async function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // O parâmetro é o token público aleatório — nunca buscar pelo ID sequencial,
    // senão qualquer um enumera entregas alheias trocando o número da URL.
    if (!id || id.length < 8) notFound();

    const delivery = await db.query.deliveries.findFirst({
        where: eq(deliveries.publicToken, id),
        with: {
            motoboy: true,
            shopkeeper: true
        }
    });

    if (!delivery) notFound();

    // Esta página é PÚBLICA (quem tem o link tem o pedido). O que ela pode
    // mostrar é o caminho do motoboy e o destino — nunca onde a loja fica:
    // o endereço físico do negócio não tem por que viajar pro celular do
    // cliente. Por isso aqui não se carrega shop_settings, e o mapa recebe só
    // a posição do motoboy.
    let motoboyLocation = null;

    if (delivery.motoboyId) {
        const result = await carregarLocalDoMotoboy(delivery.motoboyId);
        if (result && result.lat && result.lng) {
            motoboyLocation = { lat: result.lat, lng: result.lng };
        }
    }

    // Enquanto o pedido está andando vale atualizar sozinho; entregue/cancelado
    // é estado final e ficar batendo no servidor só gasta dado do cliente.
    const emAndamento = delivery.status !== "delivered" && delivery.status !== "canceled";

    const modoCobranca = chargeModeDaCorrida(delivery);
    const temValor = delivery.value != null && delivery.value > 0;

    return (
        <div className="min-h-screen bg-zinc-50 text-zinc-900">
            {emAndamento && <AutoRefresh segundos={20} />}
            <header className="bg-white p-4 shadow-sm flex items-center gap-4">
                <div className="font-bold text-lg text-green-600">Zap Entregas</div>
                {/* O número do dia é o que a loja usa pra falar do pedido ("a
                    Corrida 7 já saiu?"). É só um contador: não diz nada sobre o
                    cliente nem sobre o movimento da loja, então pode aparecer
                    nesta página, que é pública. Pedido antigo cai no id. */}
                <div className="text-sm text-zinc-600">
                    {rotuloCorrida(delivery.dailySeq)
                        ? `Rastreio · ${rotuloCorrida(delivery.dailySeq)}`
                        : `Rastreio de Pedido #${delivery.id}`}
                </div>
            </header>

            <main className="max-w-lg mx-auto p-4 space-y-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 className="font-bold text-xl text-zinc-900">
                                {delivery.status === 'draft' && "Preparando seu pedido"}
                                {delivery.status === 'pending' && "Aguardando Motoboy"}
                                {delivery.status === 'assigned' && "Motoboy a caminho"}
                                {delivery.status === 'picked_up' && "Saiu para entrega"}
                                {delivery.status === 'delivered' && "Entregue"}
                                {delivery.status === 'canceled' && "Cancelado"}
                            </h1>
                            {/* Previsão só depois que o motoboy PEGOU o pedido: antes disso
                                ninguém saiu da loja, e prometer "15-20 min" numa corrida que
                                nem foi aceita faz o cliente cobrar atraso que não existe. */}
                            <p className="text-zinc-600 text-sm">
                                {delivery.status === 'delivered'
                                    ? "Pedido entregue. Obrigado!"
                                    : delivery.status === 'canceled'
                                        ? "Esse pedido foi cancelado. Fale com a loja."
                                        : delivery.status === 'picked_up'
                                            ? "Previsão: 15-20 min"
                                            : delivery.status === 'assigned'
                                                ? "Um motoboy já pegou seu pedido e está indo buscar na loja."
                                                : "A loja está preparando e logo um motoboy pega seu pedido."}
                            </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                            ${delivery.status === 'delivered' ? 'bg-green-100 text-green-700'
                                : delivery.status === 'canceled' ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-700'}
                        `}>
                            {STATUS_LABEL[delivery.status] ?? delivery.status}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-zinc-200 font-bold text-zinc-700">
                                🏪
                            </div>
                            <div>
                                <div className="text-xs text-zinc-600">Loja</div>
                                {/* text-zinc-900 explícito: sem cor própria, no celular com tema
                                    escuro esse texto herdava #ededed e sumia no fundo branco. */}
                                <div className="font-medium text-zinc-900">{delivery.shopkeeper?.name || "Loja Parceira"}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-zinc-200 font-bold text-zinc-700">
                                📍
                            </div>
                            <div>
                                <div className="text-xs text-zinc-600">Destino</div>
                                <div className="font-medium text-zinc-900">{delivery.address}</div>
                            </div>
                        </div>

                        {/* Como o pedido é pago. Enquanto está a caminho isto evita a
                            cena mais chata da entrega: o motoboy na porta e o cliente
                            sem saber se tinha que pagar, e quanto. Pedido já pago não
                            mostra nada — não há o que avisar. */}
                        {emAndamento && modoCobranca !== "pago" && (
                            <div className={`flex items-center gap-3 p-3 rounded-lg border ${modoCobranca === "conferir" ? "bg-sky-50 border-sky-200" : "bg-amber-50 border-amber-200"}`}>
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-zinc-200 font-bold text-zinc-700">
                                    {modoCobranca === "conferir" ? "🔎" : "💵"}
                                </div>
                                <div>
                                    <div className="text-xs text-zinc-600">Pagamento</div>
                                    <div className="font-medium text-zinc-900">
                                        {modoCobranca === "conferir"
                                            ? `Pix da loja${temValor ? ` · ${formatBRL(delivery.value!)}` : ""}`
                                            : `A pagar na entrega${temValor ? ` · ${formatBRL(delivery.value!)}` : ""}`}
                                    </div>
                                    <div className="text-xs text-zinc-600">
                                        {modoCobranca === "conferir"
                                            ? "O motoboy confere se o Pix caiu antes de entregar."
                                            : "Combine o troco com a loja se for pagar em dinheiro."}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6">
                        {delivery.motoboyId && motoboyLocation && delivery.status !== 'canceled' && delivery.status !== 'delivered' ? (
                            <TrackingMapWrapper motoboyLocation={motoboyLocation} googleMapsKey={getBrowserMapsKey()} />
                        ) : (
                            <div className="h-[200px] bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-600 text-sm text-center p-4">
                                {delivery.status === 'canceled'
                                    ? "Pedido cancelado — não há entrega em andamento."
                                    : delivery.status === 'delivered'
                                        ? "Entrega concluída."
                                        : delivery.motoboyId
                                            ? "Aguardando sinal do motoboy..."
                                            : "Aguardando um motoboy aceitar seu pedido."}
                            </div>
                        )}
                    </div>
                </div>

                {delivery.motoboy && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 flex items-center gap-4">
                        {delivery.motoboy.avatarUrl ? (
                            <img
                                src={delivery.motoboy.avatarUrl}
                                alt={`Foto de ${delivery.motoboy.name}`}
                                className="w-12 h-12 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-12 h-12 bg-zinc-200 rounded-full"></div>
                        )}
                        <div>
                            <div className="font-bold text-zinc-900">{delivery.motoboy.name}</div>
                            <div className="text-sm text-zinc-600">Seu entregador</div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
