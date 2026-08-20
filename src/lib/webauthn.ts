import { cookies } from "next/headers";

/**
 * Desbloqueio por digital (WebAuthn / passkey).
 *
 * A digital nunca sai do aparelho: quem confere o dedo é o próprio celular.
 * O que trafega é uma assinatura feita por uma chave que só existe lá dentro;
 * aqui guardamos apenas a chave pública correspondente.
 */

/** Domínio do app — o navegador exige que bata com o site aberto. */
export function rpID(): string {
    try {
        return new URL(baseUrl()).hostname;
    } catch {
        return "zapentregas.duckdns.org";
    }
}

/** Endereço completo esperado (com esquema e porta). */
export function expectedOrigin(): string {
    return baseUrl().replace(/\/$/, "");
}

function baseUrl(): string {
    // Mesma regra do login com Google: env lida em tempo de execução, nunca NEXT_PUBLIC_*
    // (que é congelada quando a imagem é construída na máquina do dev).
    return process.env.OAUTH_BASE_URL || process.env.APP_URL || "https://zapentregas.duckdns.org";
}

export const RP_NAME = "Zap Entregas";

const CHALLENGE_COOKIE = "webauthn_challenge";

/**
 * O desafio precisa sobreviver entre "pedir" e "conferir". Vai num cookie
 * httpOnly de vida curta — não é segredo, mas tem que ser o mesmo dos dois lados.
 */
export async function saveChallenge(challenge: string): Promise<void> {
    const store = await cookies();
    store.set(CHALLENGE_COOKIE, challenge, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 5,
    });
}

export async function takeChallenge(): Promise<string | null> {
    const store = await cookies();
    const value = store.get(CHALLENGE_COOKIE)?.value ?? null;
    // Um desafio só vale uma vez.
    store.delete(CHALLENGE_COOKIE);
    return value;
}

/** Nome curto do aparelho, pra pessoa reconhecer na lista. */
export function guessDeviceName(userAgent: string | null): string {
    if (!userAgent) return "Aparelho";
    const ua = userAgent.toLowerCase();
    if (ua.includes("android")) return "Android";
    if (ua.includes("iphone")) return "iPhone";
    if (ua.includes("ipad")) return "iPad";
    if (ua.includes("mac os")) return "Mac";
    if (ua.includes("windows")) return "Windows";
    if (ua.includes("linux")) return "Linux";
    return "Aparelho";
}
