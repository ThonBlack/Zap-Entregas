"use server";

import { db } from "@/db";
import { reviews, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

interface ReviewData {
    deliveryId: number;
    motoboyId: number;
    shopkeeperId: number | null;
    customerName: string;
    ratingGeneral: number;
    ratingDelivery: number;
    feedback?: string;
}

export async function submitReviewAction(data: ReviewData) {
    try {
        // Inserir a avaliação
        await db.insert(reviews).values({
            deliveryId: data.deliveryId,
            motoboyId: data.motoboyId,
            shopkeeperId: data.shopkeeperId,
            customerName: data.customerName,
            ratingGeneral: data.ratingGeneral,
            ratingDelivery: data.ratingDelivery,
            feedback: data.feedback || null,
        });

        // Atualizar a média do motoboy
        const motoboy = await db.query.users.findFirst({
            where: eq(users.id, data.motoboyId)
        });

        if (motoboy) {
            // Calcular nova média geral
            const currentRating = motoboy.rating || 0;
            const currentCount = motoboy.ratingCount || 0;
            const newCount = currentCount + 1;
            const newRating = ((currentRating * currentCount) + data.ratingGeneral) / newCount;

            // Calcular nova média de entrega
            const currentDeliveryRating = motoboy.ratingDelivery || 0;
            const currentDeliveryCount = motoboy.ratingDeliveryCount || 0;
            const newDeliveryCount = currentDeliveryCount + 1;
            const newDeliveryRating = ((currentDeliveryRating * currentDeliveryCount) + data.ratingDelivery) / newDeliveryCount;

            await db.update(users).set({
                rating: newRating,
                ratingCount: newCount,
                ratingDelivery: newDeliveryRating,
                ratingDeliveryCount: newDeliveryCount,
            }).where(eq(users.id, data.motoboyId));
        }

        // Se tiver lojista, também atualizar rating dele
        if (data.shopkeeperId) {
            const shopkeeper = await db.query.users.findFirst({
                where: eq(users.id, data.shopkeeperId)
            });

            if (shopkeeper) {
                const currentRating = shopkeeper.rating || 0;
                const currentCount = shopkeeper.ratingCount || 0;
                const newCount = currentCount + 1;
                const newRating = ((currentRating * currentCount) + data.ratingGeneral) / newCount;

                await db.update(users).set({
                    rating: newRating,
                    ratingCount: newCount,
                }).where(eq(users.id, data.shopkeeperId));
            }
        }

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar avaliação:", error);
        return { error: "Erro ao salvar avaliação" };
    }
}
