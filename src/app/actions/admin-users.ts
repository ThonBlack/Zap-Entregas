"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { hashPassword } from "@/lib/password";
import { getAuthUserWithRole } from "@/lib/session";

const VALID_ROLES = ["shopkeeper", "motoboy", "admin"] as const;
const VALID_PLANS = ["free", "basic", "pro", "growth", "enterprise"] as const;

export async function adminCreateUserAction(prevState: any, formData: FormData) {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) return { error: auth.error };

    const name = ((formData.get("name") as string) || "").trim();
    const phone = ((formData.get("phone") as string) || "").trim();
    const emailRaw = ((formData.get("email") as string) || "").trim();
    const email = emailRaw || null;
    const role = (formData.get("role") as string) || "";
    const password = (formData.get("password") as string) || "";
    const plan = (formData.get("plan") as string) || "free";

    if (!name || !phone || !role || !password) {
        return { error: "Nome, telefone, papel e senha são obrigatórios." };
    }
    if (!VALID_ROLES.includes(role as any)) return { error: "Papel inválido." };
    if (!VALID_PLANS.includes(plan as any)) return { error: "Plano inválido." };
    if (password.length < 8) return { error: "Senha mínima de 8 caracteres." };

    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, phone))
        .get();
    if (existing) return { error: "Telefone já cadastrado." };

    if (email) {
        const dupEmail = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .get();
        if (dupEmail) return { error: "Email já cadastrado." };
    }

    const hashed = await hashPassword(password);

    let newUserId: number | undefined;
    try {
        const inserted = await db
            .insert(users)
            .values({
                name,
                phone,
                email,
                password: hashed,
                role: role as (typeof VALID_ROLES)[number],
                plan: plan as (typeof VALID_PLANS)[number],
                subscriptionStatus: "active",
            })
            .returning({ id: users.id })
            .get();
        newUserId = inserted?.id;
    } catch {
        return { error: "Falha ao criar usuário no banco." };
    }

    revalidatePath("/admin/users");
    revalidatePath("/admin");

    if (newUserId) {
        redirect(`/admin/users/${newUserId}`);
    }
    redirect("/admin/users");
}

export async function adminGenerateApiKeyForUserAction(targetUserId: number) {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) return { error: auth.error };

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return { error: "ID inválido." };
    }

    const target = await db.query.users.findFirst({
        where: eq(users.id, targetUserId),
        columns: { id: true, role: true },
    });
    if (!target) return { error: "Usuário não encontrado." };
    if (target.role !== "shopkeeper") {
        return { error: "API Key só pode ser gerada para lojistas." };
    }

    const randomPart = crypto.randomBytes(24).toString("hex");
    const apiKey = `zap_${target.id}_${randomPart}`;

    await db.update(users).set({ apiKey }).where(eq(users.id, targetUserId));

    revalidatePath(`/admin/users/${targetUserId}`);
    return { success: true, apiKey };
}

export async function adminRevokeApiKeyForUserAction(targetUserId: number) {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) return { error: auth.error };

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return { error: "ID inválido." };
    }

    await db.update(users).set({ apiKey: null }).where(eq(users.id, targetUserId));
    revalidatePath(`/admin/users/${targetUserId}`);
    return { success: true };
}
