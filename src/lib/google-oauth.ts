import crypto from "crypto";

/**
 * Login com Google feito na mão (OAuth 2.0 + OpenID Connect).
 * O app já tem sessão própria assinada; uma biblioteca de auth completa só
 * duplicaria esse controle. Aqui só trocamos o "code" do Google por um id_token
 * e lemos quem é a pessoa.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface GoogleProfile {
    sub: string;      // id permanente da conta Google (não muda se a pessoa trocar de e-mail)
    email: string;
    emailVerified: boolean;
    name?: string;
    picture?: string;
}

export function isGoogleLoginConfigured(): boolean {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Endereço de retorno registrado no Google.
 * NÃO usar NEXT_PUBLIC_BASE_URL: valores NEXT_PUBLIC_* são congelados quando a
 * imagem é construída (na máquina do dev), então em produção viraria localhost.
 * APP_URL é lida em tempo de execução, direto do compose da VPS.
 */
export function googleRedirectUri(): string {
    const base = process.env.OAUTH_BASE_URL || process.env.APP_URL || "https://zapentregas.duckdns.org";
    return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

export function newOauthState(): string {
    return crypto.randomBytes(24).toString("base64url");
}

export function buildAuthUrl(state: string): string {
    const url = new URL(AUTH_ENDPOINT);
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    url.searchParams.set("redirect_uri", googleRedirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    // Sem refresh token: só queremos identificar a pessoa uma vez, no login.
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
    return url.toString();
}

/**
 * Troca o code pelo id_token. A chamada é servidor→Google por HTTPS, então o
 * id_token pode ser lido direto (é o próprio Google respondendo, não o navegador).
 */
export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile | null> {
    const res = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: googleRedirectUri(),
            grant_type: "authorization_code",
        }),
    });

    if (!res.ok) {
        console.error("[GOOGLE] troca do code falhou:", res.status, (await res.text()).slice(0, 300));
        return null;
    }

    const data = await res.json() as { id_token?: string };
    if (!data.id_token) return null;

    const payload = decodeJwtPayload(data.id_token);
    if (!payload) return null;

    // Confere que o token foi emitido pra este app (defesa contra token de outro cliente).
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        console.error("[GOOGLE] id_token de outro client_id");
        return null;
    }
    if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
        console.error("[GOOGLE] emissor inesperado:", payload.iss);
        return null;
    }
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
        console.error("[GOOGLE] id_token expirado");
        return null;
    }
    if (!payload.sub || !payload.email) return null;

    return {
        sub: String(payload.sub),
        email: String(payload.email).toLowerCase(),
        emailVerified: payload.email_verified === true || payload.email_verified === "true",
        name: payload.name ? String(payload.name) : undefined,
        picture: payload.picture ? String(payload.picture) : undefined,
    };
}

type JwtPayload = Record<string, unknown> & {
    aud?: string; iss?: string; exp?: number; sub?: string; email?: string;
    email_verified?: boolean | string; name?: string; picture?: string;
};

function decodeJwtPayload(token: string): JwtPayload | null {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    try {
        return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as JwtPayload;
    } catch {
        return null;
    }
}
