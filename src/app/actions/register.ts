"use server";

import { db } from "../../db";
import { users } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { hashPassword } from "../../lib/password";
import { setSessionCookie } from "../../lib/session";

const TRIAL_DAYS = 30;
const MAX_TRIAL_USERS = 100;

export async function registerAction(prevState: any, formData: FormData) {
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string | null;
    const password = formData.get("password") as string;
    const role = formData.get("role") as "shopkeeper" | "motoboy";

    if (!name || !phone || !password || !role) {
        return { message: "Preencha todos os campos obrigatórios." };
    }

    if (password.length < 8) {
        return { message: "A senha deve ter pelo menos 8 caracteres." };
    }

    if (role !== "shopkeeper" && role !== "motoboy") {
        return { message: "Tipo de conta inválido." };
    }

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.phone, phone)).get();
    if (existingUser) {
        return { message: "Este número de celular já está cadastrado." };
    }

    // Check how many users exist to determine if new user gets trial
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users).get();
    const totalUsers = userCount?.count || 0;
    const givesTrial = totalUsers < MAX_TRIAL_USERS;

    // Calculate trial end date (30 days from now)
    const trialEndsAt = givesTrial
        ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : null;

    // Hash da senha antes de salvar
    const hashedPassword = await hashPassword(password);

    // Create user with trial if applicable
    const newUser = await db.insert(users).values({
        name,
        phone,
        email: email || null, // Email opcional para recuperação de senha
        password: hashedPassword,
        role,
        plan: givesTrial ? "enterprise" : "free",
        subscriptionStatus: givesTrial ? "trial" : "active",
        isTrialUser: givesTrial,
        trialEndsAt,
    }).returning().get();

    if (!newUser) {
        return { message: "Erro ao criar conta. Tente novamente." };
    }

    // Auto-login after registration
    await setSessionCookie(newUser.id);

    if (role === 'shopkeeper') {
        redirect("/settings");
    } else {
        redirect("/app");
    }
}
