"use server";

import { db } from "@/db";
import { reviews, users, deliveries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

interface ReviewData {
    /**
     * Token público da entrega (o mesmo do link de rastreio). O cliente não tem
     * login: é o token que prova que ele recebeu ESTA entrega. Com o id
     * sequencial, qualquer um avaliava a entrega dos outros trocando o número.
     */
    token: string;
    customerName: string;
    ratingGeneral: number;
    ratingDelivery: number;
    feedback?: string;
}

function clampRating(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(1, Math.min(5, Math.round(value)));
}

export async function submitReviewAction(data: ReviewData) {
    try {
        if (typeof data.token !== "string" || data.token.length < 8) {
            return { error: "Entrega inválida" };
        }

        const delivery = await db.query.deliveries.findFirst({
            where: eq(deliveries.publicToken, data.token),
            columns: { id: true, motoboyId: true, shopkeeperId: true, status: true },
        });
        if (!delivery) return { error: "Entrega não encontrada" };
        if (delivery.status !== "delivered") return { error: "Entrega ainda não foi finalizada" };
        if (!delivery.motoboyId) return { error: "Entrega sem motoboy" };

        const existing = await db.query.reviews.findFirst({
            where: eq(reviews.deliveryId, delivery.id),
            columns: { id: true },
        });
        if (existing) return { error: "Esta entrega já foi avaliada." };

        const ratingGeneral = clampRating(data.ratingGeneral);
        const ratingDeliveryVal = clampRating(data.ratingDelivery);
        if (ratingGeneral < 1 || ratingDeliveryVal < 1) {
            return { error: "Avaliação inválida" };
        }

        const feedback = typeof data.feedback === "string" ? data.feedback.slice(0, 1000) : null;
        const customerName = typeof data.customerName === "string" ? data.customerName.slice(0, 100) : "";

        await db.insert(reviews).values({
            deliveryId: delivery.id,
            motoboyId: delivery.motoboyId,
            shopkeeperId: delivery.shopkeeperId,
            customerName,
            ratingGeneral,
            ratingDelivery: ratingDeliveryVal,
            feedback,
            createdAt: new Date().toISOString(),
        });

        const motoboy = await db.query.users.findFirst({
            where: eq(users.id, delivery.motoboyId),
        });

        if (motoboy) {
            const currentRating = motoboy.rating || 0;
            const currentCount = motoboy.ratingCount || 0;
            const newCount = currentCount + 1;
            const newRating = ((currentRating * currentCount) + ratingGeneral) / newCount;

            const currentDeliveryRating = motoboy.ratingDelivery || 0;
            const currentDeliveryCount = motoboy.ratingDeliveryCount || 0;
            const newDeliveryCount = currentDeliveryCount + 1;
            const newDeliveryRating =
                ((currentDeliveryRating * currentDeliveryCount) + ratingDeliveryVal) / newDeliveryCount;

            await db.update(users).set({
                rating: newRating,
                ratingCount: newCount,
                ratingDelivery: newDeliveryRating,
                ratingDeliveryCount: newDeliveryCount,
            }).where(eq(users.id, delivery.motoboyId));
        }

        if (delivery.shopkeeperId) {
            const shopkeeper = await db.query.users.findFirst({
                where: eq(users.id, delivery.shopkeeperId),
            });

            if (shopkeeper) {
                const currentRating = shopkeeper.rating || 0;
                const currentCount = shopkeeper.ratingCount || 0;
                const newCount = currentCount + 1;
                const newRating = ((currentRating * currentCount) + ratingGeneral) / newCount;

                await db.update(users).set({
                    rating: newRating,
                    ratingCount: newCount,
                }).where(eq(users.id, delivery.shopkeeperId));
            }
        }

        revalidatePath("/app");
        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar avaliação:", error);
        return { error: "Erro ao salvar avaliação" };
    }
}
