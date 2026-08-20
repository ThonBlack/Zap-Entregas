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
                body,
                // urgency "high": o Android entrega na hora em vez de segurar até o
                // aparelho sair da economia de bateria. TTL 10min: corrida velha não serve.
                { urgency: "high", TTL: 600 }
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

/**
 * Notifica quem pode liberar um rascunho: o lojista dono da corrida + os admins.
 * Usado quando a venda do PDV cria a corrida — ela ainda não vai pros motoboys.
 */
export async function pushToDraftReviewers(shopkeeperId: number | null, payload: PushPayload): Promise<void> {
    if (!ensureConfigured()) return;
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    const ids = new Set(admins.map(a => a.id));
    if (shopkeeperId != null) ids.add(shopkeeperId);
    if (!ids.size) return;
    const subs = await db.select().from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, [...ids]));
    await sendToSubscriptions(subs, payload);
}

/**
 * Notifica o pool de corrida nova: todos os motoboys + os admins.
 * O admin entra porque é ele quem acompanha a operação (e, hoje, quem testa no celular);
 * sem isso uma corrida nova não avisava ninguém quando não havia motoboy inscrito.
 */
export async function pushToMotoboys(payload: PushPayload): Promise<void> {
    if (!ensureConfigured()) return;
    const audience = await db.select({ id: users.id }).from(users)
        .where(inArray(users.role, ["motoboy", "admin"]));
    if (!audience.length) return;
    const subs = await db.select().from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, audience.map(m => m.id)));
    await sendToSubscriptions(subs, payload);
}
