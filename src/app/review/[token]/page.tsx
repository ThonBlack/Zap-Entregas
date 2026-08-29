import { db } from "@/db";
import { deliveries, reviews } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ReviewForm from "@/components/deliveries/ReviewForm";

interface ReviewPageProps {
    params: Promise<{ token: string }>;
}

/**
 * Avaliação da entrega, aberta pelo cliente (sem login).
 *
 * O endereço é o TOKEN público da entrega — o mesmo do rastreio —, nunca o id.
 * Com /review/1, /review/2… qualquer um ia trocando o número e lia nome do
 * cliente e do entregador de todas as entregas da operação. A rota antiga por
 * id não existe mais: link velho dá 404, e é isso mesmo.
 */
export default async function ReviewPage({ params }: ReviewPageProps) {
    const { token } = await params;

    if (!token || token.length < 8) notFound();

    const delivery = await db.query.deliveries.findFirst({
        where: eq(deliveries.publicToken, token),
        with: {
            motoboy: true,
            shopkeeper: true
        }
    });

    if (!delivery || delivery.status !== "delivered") {
        notFound();
    }

    // Verificar se já foi avaliada
    const existingReview = await db.query.reviews.findFirst({
        where: eq(reviews.deliveryId, delivery.id)
    });

    if (existingReview) {
        return (
            <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-zinc-800 rounded-2xl p-8 text-center border border-zinc-700">
                    <div className="text-6xl mb-4">✅</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Obrigado!</h1>
                    <p className="text-zinc-400">Esta entrega já foi avaliada.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-zinc-800 rounded-2xl p-6 border border-zinc-700 mb-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
                            <span className="text-2xl">🏍️</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Avalie sua entrega!</h1>
                            <p className="text-sm text-zinc-400">Entrega #{delivery.id}</p>
                        </div>
                    </div>

                    {delivery.motoboy && (
                        <div className="bg-zinc-700/50 rounded-xl p-4 mb-4">
                            <p className="text-sm text-zinc-400">Entregador</p>
                            <p className="text-white font-medium">{delivery.motoboy.name}</p>
                        </div>
                    )}
                </div>

                <ReviewForm
                    token={token}
                    customerName={delivery.customerName || "Cliente"}
                />
            </div>
        </div>
    );
}
