"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { saveFile } from "@/lib/upload";

export async function createMotoboyAction(formData: FormData) {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;
    if (!userId) return { error: "Não autenticado" };

    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const password = formData.get("password") as string || "123456";

    // Handle File
    const file = formData.get("avatar") as File;
    let avatarUrl = null;

    if (file && file.size > 0 && file.name !== "undefined") {
        avatarUrl = await saveFile(file);
    }

    if (!name || !phone) {
        return { error: "Nome e Telefone são obrigatórios" };
    }

    try {
        await db.insert(users).values({
            name,
            phone,
            password,
            avatarUrl,
            lastAvatarUpdate: avatarUrl ? new Date().toISOString() : null,
            role: "motoboy",
        });
    } catch (e) {
        return { error: "Erro ao criar motoboy. Telefone já cadastrado?" };
    }

    redirect("/motoboys");
}

export async function updateMotoboyAction(formData: FormData) {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;

    const file = formData.get("avatar") as File;

    if (!id || !name) return { error: "Dados inválidos" };

    // Check 30 days rule if avatar is changing
    const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(id)),
        columns: { avatarUrl: true, lastAvatarUpdate: true }
    });

    let newAvatarUrl = currentUser?.avatarUrl;
    let newLastUpdate = currentUser?.lastAvatarUpdate;

    if (file && file.size > 0 && file.name !== "undefined") {
        // User uploaded a new file
        if (currentUser?.lastAvatarUpdate) {
            const lastUpdate = new Date(currentUser.lastAvatarUpdate);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 30) {
                return { error: `A foto só pode ser alterada a cada 30 dias. Espere mais ${30 - diffDays} dias.` };
            }
        }

        newAvatarUrl = await saveFile(file);
        newLastUpdate = new Date().toISOString();
    }

    await db.update(users)
        .set({ name, avatarUrl: newAvatarUrl, lastAvatarUpdate: newLastUpdate })
        .where(eq(users.id, Number(id)));

    redirect("/motoboys");
}
