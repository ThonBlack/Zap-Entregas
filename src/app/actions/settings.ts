"use server";

import { db } from "@/db";
import { shopSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { saveFile } from "@/lib/upload";
import { getAuthUser } from "@/lib/session";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function updateSettingsAction(prevState: any, formData: FormData) {
    const auth = await getAuthUser();
    if ("error" in auth) redirect("/login");
    const userId = auth.user.id;

    const remunerationModel = formData.get("remunerationModel") as "fixed" | "distance" | "daily" | "hybrid";
    if (!["fixed", "distance", "daily", "hybrid"].includes(remunerationModel)) {
        return { message: "Modelo inválido.", success: false };
    }

    const fixedValue = parseFloat((formData.get("fixedValue") as string || "0").replace(",", "."));
    const valuePerKm = parseFloat((formData.get("valuePerKm") as string || "0").replace(",", "."));
    const dailyValue = parseFloat((formData.get("dailyValue") as string || "0").replace(",", "."));
    const guaranteedMinimum = parseFloat((formData.get("guaranteedMinimum") as string || "0").replace(",", "."));

    const showCustomerName = formData.get("showCustomerName") === "on";
    const showCustomerPhone = formData.get("showCustomerPhone") === "on";
    const showOrderValue = formData.get("showOrderValue") === "on";
    const showObservation = formData.get("showObservation") === "on";

    const defaultCity = ((formData.get("defaultCity") as string) || "").trim() || null;
    const defaultStateRaw = ((formData.get("defaultState") as string) || "").trim().toUpperCase();
    const defaultState = /^[A-Z]{2}$/.test(defaultStateRaw) ? defaultStateRaw : null;
    const shopLatRaw = (formData.get("shopLat") as string) || "";
    const shopLngRaw = (formData.get("shopLng") as string) || "";
    const parsedLat = parseFloat(shopLatRaw);
    const parsedLng = parseFloat(shopLngRaw);
    const shopLat = Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90 ? parsedLat : null;
    const shopLng = Number.isFinite(parsedLng) && parsedLng >= -180 && parsedLng <= 180 ? parsedLng : null;

    try {
        const existingSettings = await db.select().from(shopSettings).where(eq(shopSettings.userId, userId)).get();

        if (existingSettings) {
            await db.update(shopSettings).set({
                remunerationModel,
                fixedValue,
                valuePerKm,
                dailyvalue: dailyValue,
                guaranteedMinimum,
                showCustomerName,
                showCustomerPhone,
                showOrderValue,
                showObservation,
                defaultCity,
                defaultState,
                shopLat,
                shopLng,
                updatedAt: new Date().toISOString(),
            }).where(eq(shopSettings.userId, userId));
        } else {
            await db.insert(shopSettings).values({
                userId,
                remunerationModel,
                fixedValue,
                valuePerKm,
                dailyvalue: dailyValue,
                guaranteedMinimum,
                showCustomerName,
                showCustomerPhone,
                showOrderValue,
                showObservation,
                defaultCity,
                defaultState,
                shopLat,
                shopLng,
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
    const auth = await getAuthUser();
    if ("error" in auth) redirect("/login");
    const userId = auth.user.id;

    const name = (formData.get("name") as string)?.trim();
    const file = formData.get("avatar") as File | null;
    const removeAvatar = formData.get("removeAvatar") === "true";

    try {
        const currentUser = await db.select().from(users).where(eq(users.id, userId)).get();
        if (!currentUser) return { message: "Usuário não encontrado", success: false };

        let avatarUrl = currentUser.avatarUrl;
        let lastUpdate = currentUser.lastAvatarUpdate;

        const hasUpload = file && typeof file !== "string" && file.size > 0 && file.name !== "undefined";

        if (hasUpload && currentUser.role === "motoboy") {
            if (lastUpdate) {
                const diffDays = Math.floor(
                    (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24)
                );
                if (diffDays < 30) {
                    const daysRemaining = 30 - diffDays;
                    return {
                        message: `Você só pode trocar a foto novamente em ${daysRemaining} dia${daysRemaining > 1 ? "s" : ""}.`,
                        success: false,
                    };
                }
            }
        }

        if (removeAvatar) {
            avatarUrl = null;
        } else if (hasUpload) {
            if (file!.size > MAX_AVATAR_BYTES) {
                return { message: "Imagem maior que 5MB.", success: false };
            }
            if (!ALLOWED_MIME.has(file!.type)) {
                return { message: "Formato inválido. Use JPG, PNG ou WebP.", success: false };
            }
            avatarUrl = await saveFile(file!);
            lastUpdate = new Date().toISOString();
        }

        await db.update(users).set({
            name: name || currentUser.name,
            avatarUrl,
            lastAvatarUpdate: lastUpdate,
        }).where(eq(users.id, userId));

        revalidatePath("/app");
        revalidatePath("/settings");
        revalidatePath("/settings/motoboy");
        return { message: "Perfil atualizado com sucesso!", success: true };
    } catch (e) {
        console.error(e);
        return { message: "Erro ao atualizar perfil.", success: false };
    }
}

export async function updateDailyGoalAction(goal: number) {
    const auth = await getAuthUser();
    if ("error" in auth) redirect("/login");

    if (!Number.isInteger(goal) || goal < 0 || goal > 1000) {
        return { error: "Meta inválida." };
    }

    try {
        await db.update(users).set({ dailyGoal: goal }).where(eq(users.id, auth.user.id));
        revalidatePath("/app");
        revalidatePath("/settings/motoboy");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "Erro ao salvar meta diária." };
    }
}

export async function generateApiKeyAction() {
    const auth = await getAuthUser();
    if ("error" in auth) redirect("/login");
    const userId = auth.user.id;

    try {
        const randomPart = crypto.randomBytes(24).toString("hex");
        const apiKey = `zap_${userId}_${randomPart}`;

        await db.update(users).set({ apiKey }).where(eq(users.id, userId));

        revalidatePath("/settings");
        return { success: true, apiKey };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Erro ao gerar API Key." };
    }
}
