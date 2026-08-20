"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/session";

/** Desconecta a conta Google do usuário logado. */
export async function unlinkGoogleAction(): Promise<{ error: string } | { success: true }> {
    const auth = await getAuthUser();
    if ("error" in auth) return { error: auth.error };

    const me = await db.query.users.findFirst({ where: eq(users.id, auth.user.id) });
    if (!me) return { error: "Usuário não encontrado." };

    // Sem senha cadastrada, tirar o Google deixaria a pessoa sem nenhuma forma de entrar.
    if (!me.password) {
        return { error: "Cadastre uma senha antes de desconectar o Google, senão você fica sem como entrar." };
    }

    await db.update(users).set({ googleId: null }).where(eq(users.id, me.id));

    revalidatePath("/settings");
    revalidatePath("/settings/motoboy");
    return { success: true };
}
