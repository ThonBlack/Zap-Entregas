"use server";

import { db } from "@/db";
import { shopSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function updateSettingsAction(prevState: any, formData: FormData) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    const remunerationModel = formData.get("remunerationModel") as "fixed" | "distance" | "daily" | "hybrid";
    const fixedValue = parseFloat((formData.get("fixedValue") as string || "0").replace(",", "."));
    const valuePerKm = parseFloat((formData.get("valuePerKm") as string || "0").replace(",", "."));
    const dailyValue = parseFloat((formData.get("dailyValue") as string || "0").replace(",", "."));
    const guaranteedMinimum = parseFloat((formData.get("guaranteedMinimum") as string || "0").replace(",", "."));

    try {
        // Check if settings exist for user
        const existingSettings = await db.select().from(shopSettings).where(eq(shopSettings.userId, Number(userId))).get();

        if (existingSettings) {
            await db.update(shopSettings).set({
                remunerationModel,
                fixedValue,
                valuePerKm,
                dailyvalue: dailyValue,
                guaranteedMinimum,
                updatedAt: new Date().toISOString()
            }).where(eq(shopSettings.userId, Number(userId)));
        } else {
            await db.insert(shopSettings).values({
                userId: Number(userId),
                remunerationModel,
                fixedValue,
                valuePerKm,
                dailyvalue: dailyValue,
                guaranteedMinimum
            });
        }

        revalidatePath("/settings");
        return { message: "Configurações salvas com sucesso!", success: true };
    } catch (e) {
        console.error(e);
        return { message: "Erro ao salvar configurações.", success: false };
    }
}
