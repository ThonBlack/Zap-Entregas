"use server";

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/session";

interface SubscriptionInput {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

export async function savePushSubscriptionAction(sub: SubscriptionInput, userAgent?: string) {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;
    const me = auth.user;

    if (!sub?.endpoint || typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://")) {
        return { error: "Inscrição inválida" };
    }
    if (!sub.keys?.p256dh || !sub.keys?.auth) return { error: "Chaves da inscrição ausentes" };

    // Mesmo endpoint re-inscrito (ex.: trocou de usuário no mesmo celular): sobrescreve o dono
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
    await db.insert(pushSubscriptions).values({
        userId: me.id,
        endpoint: sub.endpoint.slice(0, 1000),
        p256dh: sub.keys.p256dh.slice(0, 300),
        auth: sub.keys.auth.slice(0, 300),
        userAgent: typeof userAgent === "string" ? userAgent.slice(0, 300) : null,
    });

    return { success: true };
}

export async function removePushSubscriptionAction(endpoint: string) {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;

    if (typeof endpoint !== "string" || !endpoint) return { error: "Endpoint inválido" };
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    return { success: true };
}
