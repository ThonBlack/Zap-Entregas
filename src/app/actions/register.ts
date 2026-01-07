"use server";

import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function registerAction(prevState: any, formData: FormData) {
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as "shopkeeper" | "motoboy";

    if (!name || !phone || !password || !role) {
        return { message: "Preencha todos os campos obrigatórios." };
    }

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.phone, phone)).get();
    if (existingUser) {
        return { message: "Este número de celular já está cadastrado." };
    }

    // Create user
    const newUser = await db.insert(users).values({
        name,
        phone,
        password, // In a real app, hash this!
        role,
        plan: "free", // Default plan
        subscriptionStatus: "active"
    }).returning().get();

    if (!newUser) {
        return { message: "Erro ao criar conta. Tente novamente." };
    }

    // Auto-login after registration
    (await cookies()).set("user_id", newUser.id.toString(), {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    redirect("/");
}
