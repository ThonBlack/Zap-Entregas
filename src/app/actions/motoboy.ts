"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { saveFile } from "@/lib/upload";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/password";
import { getAuthUserWithRole } from "@/lib/session";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function pickFile(formData: FormData): File | null {
    const file = formData.get("avatar") as File | null;
    if (!file || typeof file === "string") return null;
    if (file.size === 0 || file.name === "undefined") return null;
    return file;
}

async function validateAvatarOrError(file: File): Promise<string | null> {
    if (file.size > MAX_AVATAR_BYTES) return "Imagem maior que 5MB.";
    if (!ALLOWED_MIME.has(file.type)) return "Formato de imagem inválido. Use JPG, PNG ou WebP.";
    return null;
}

export async function createMotoboyAction(formData: FormData) {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return auth;

    const name = (formData.get("name") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim();
    const password = (formData.get("password") as string) || "";

    if (!name || !phone) {
        return { error: "Nome e Telefone são obrigatórios" };
    }
    if (password && password.length < 8) {
        return { error: "Senha deve ter ao menos 8 caracteres." };
    }

    const file = pickFile(formData);
    let avatarUrl: string | null = null;

    if (file) {
        const err = await validateAvatarOrError(file);
        if (err) return { error: err };
        avatarUrl = await saveFile(file);
    }

    const finalPassword = password || crypto.randomUUID().slice(0, 12);
    const hashedPassword = await hashPassword(finalPassword);

    try {
        await db.insert(users).values({
            name,
            phone,
            password: hashedPassword,
            avatarUrl,
            lastAvatarUpdate: avatarUrl ? new Date().toISOString() : null,
            role: "motoboy",
        });
    } catch {
        return { error: "Erro ao criar motoboy. Telefone já cadastrado?" };
    }

    redirect("/motoboys");
}

export async function updateMotoboyAction(formData: FormData) {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return auth;

    const id = Number(formData.get("id"));
    const name = (formData.get("name") as string)?.trim();

    if (!Number.isInteger(id) || id <= 0 || !name) return { error: "Dados inválidos" };

    const target = await db.query.users.findFirst({
        where: eq(users.id, id),
        columns: { id: true, role: true, avatarUrl: true, lastAvatarUpdate: true },
    });

    if (!target || target.role !== "motoboy") {
        return { error: "Motoboy não encontrado" };
    }

    let newAvatarUrl = target.avatarUrl;
    let newLastUpdate = target.lastAvatarUpdate;

    const file = pickFile(formData);
    if (file) {
        const err = await validateAvatarOrError(file);
        if (err) return { error: err };

        if (target.lastAvatarUpdate) {
            const diffDays = Math.ceil(
                (Date.now() - new Date(target.lastAvatarUpdate).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays < 30) {
                return {
                    error: `A foto só pode ser alterada a cada 30 dias. Espere mais ${30 - diffDays} dias.`,
                };
            }
        }

        newAvatarUrl = await saveFile(file);
        newLastUpdate = new Date().toISOString();
    }

    await db.update(users)
        .set({ name, avatarUrl: newAvatarUrl, lastAvatarUpdate: newLastUpdate })
        .where(eq(users.id, id));

    redirect("/motoboys");
}

export async function deleteMotoboyAction(formData: FormData) {
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) return auth;

    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) return { error: "Operação inválida" };

    const target = await db.query.users.findFirst({
        where: eq(users.id, id),
        columns: { id: true, role: true },
    });
    if (!target || target.role !== "motoboy") {
        return { error: "Motoboy não encontrado" };
    }

    try {
        await db.delete(users).where(eq(users.id, id));
    } catch {
        return { error: "Erro ao excluir. O motoboy pode ter entregas vinculadas." };
    }

    revalidatePath("/motoboys");
    return { success: true };
}
