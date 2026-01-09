"use server";

import { db } from "@/db";
import { shopSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { saveFile } from "@/lib/upload";

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

export async function updateProfileAction(prevState: any, formData: FormData) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    const name = formData.get("name") as string;
    const file = formData.get("avatar") as File;
    const removeAvatar = formData.get("removeAvatar") === "true";

    try {
        const currentUser = await db.select().from(users).where(eq(users.id, Number(userId))).get();
        if (!currentUser) return { message: "Usuário não encontrado", success: false };

        let avatarUrl = currentUser.avatarUrl;
        let lastUpdate = currentUser.lastAvatarUpdate;

        if (removeAvatar) {
            avatarUrl = null;
        } else if (file && file.size > 0 && file.name !== "undefined") {
            avatarUrl = await saveFile(file);
            lastUpdate = new Date().toISOString();
        }

        await db.update(users).set({
            name: name || currentUser.name,
            avatarUrl,
            lastAvatarUpdate: lastUpdate
        }).where(eq(users.id, Number(userId)));

        revalidatePath("/");
        return { message: "Perfil atualizado com sucesso!", success: true };
    } catch (e) {
        console.error(e);
        return { message: "Erro ao atualizar perfil.", success: false };
    }
}

export async function updateDailyGoalAction(goal: number) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    try {
        await db.update(users).set({
            dailyGoal: goal
        }).where(eq(users.id, Number(userId)));

        revalidatePath("/");
        revalidatePath("/settings/motoboy");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "Erro ao salvar meta diária." };
    }
}
