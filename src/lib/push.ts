import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

let configured = false;
function ensureConfigured(): boolean {
    if (configured) return true;
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return false; // sem chaves, push vira no-op silencioso
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@zapentregas.com", pub, priv);
    configured = true;
    return true;
}

export interface PushPayload {
    title: string;
    body: string;
    url?: string; // aberto ao tocar na notificação
    tag?: string; // notificações com o mesmo tag se substituem (evita pilha de "nova corrida")
}

async function sendToSubscriptions(
    subs: { id: number; endpoint: string; p256dh: string; auth: string }[],
    payload: PushPayload
): Promise<void> {
    if (!subs.length || !ensureConfigured()) return;
    const body = JSON.stringify(payload);
    await Promise.allSettled(subs.map(async (s) => {
        try {
            await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                body
            );
        } catch (err: any) {
            // 404/410 = inscrição expirada/revogada: limpar pra não insistir
            if (err?.statusCode === 404 || err?.statusCode === 410) {
                try { await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id)); } catch { }
            } else {
                console.error("[PUSH] envio falhou:", err?.statusCode || err?.message);
            }
        }
    }));
}

/** Notifica todos os aparelhos de um usuário. */
export async function pushToUser(userId: number, payload: PushPayload): Promise<void> {
    if (!ensureConfigured()) return;
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    await sendToSubscriptions(subs, payload);
}

/** Notifica todos os motoboys ativos (pool de corridas). */
export async function pushToMotoboys(payload: PushPayload): Promise<void> {
    if (!ensureConfigured()) return;
    const motoboys = await db.select({ id: users.id }).from(users)
        .where(eq(users.role, "motoboy"));
    if (!motoboys.length) return;
    const subs = await db.select().from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, motoboys.map(m => m.id)));
    await sendToSubscriptions(subs, payload);
}
