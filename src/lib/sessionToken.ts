import crypto from "node:crypto";

/**
 * Assinatura dos cookies de login. Fica separado de `session.ts` (que é
 * "server-only" e fala com o banco) só pra poder ser testado direto por script.
 *
 * Dois tipos de token, de propósito:
 *   - "session" → você está logado de verdade.
 *   - "2fa"     → senha certa, ainda falta o código de 6 dígitos ("meio login").
 *
 * O propósito entra no texto assinado, então o valor de um NÃO funciona no
 * lugar do outro. Antes os dois eram idênticos e bastava copiar o cookie de
 * "meio login" pro cookie de sessão pra pular o segundo fator.
 */

/**
 * Idade máxima do token de sessão, conferida NO SERVIDOR.
 *
 * O cookie tem prazo (7 dias), mas prazo de cookie é só um pedido ao navegador:
 * quem copiasse o valor entrava pra sempre, porque a assinatura não vencia nunca.
 * 30 dias é folgado de propósito — o motoboy abre o app todo dia e não pode cair
 * na tela de login no meio do expediente.
 */
export const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Quanto tempo o "meio login" continua valendo (5 minutos), também no servidor. */
export const TWOFA_MAX_AGE_MS = 5 * 60 * 1000;

export type TokenPurpose = "session" | "2fa";

const TWOFA_PREFIX = "2fa";

function getSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error(
            "SESSION_SECRET ausente ou muito curta. Configure uma string aleatória de pelo menos 32 caracteres em produção."
        );
    }
    return secret;
}

function sign(payload: string): string {
    return crypto
        .createHmac("sha256", getSecret())
        .update(payload)
        .digest("base64url");
}

function timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Monta o token.
 *   session → `<id>.<ts>.<assinatura>`        (formato antigo, mantido de
 *             propósito pra ninguém que já está logado cair na tela de login)
 *   2fa     → `2fa.<id>.<ts>.<assinatura>`
 */
export function buildToken(userId: number, purpose: TokenPurpose): string {
    const payload =
        purpose === "2fa"
            ? `${TWOFA_PREFIX}.${userId}.${Date.now()}`
            : `${userId}.${Date.now()}`;
    return `${payload}.${sign(payload)}`;
}

/**
 * Confere o token para o propósito pedido e devolve o id do usuário.
 * Devolve `null` se a assinatura não bate, se o token é do OUTRO propósito,
 * ou se já passou do prazo (30 dias na sessão, 5 minutos no "meio login").
 */
export function parseToken(
    token: string | undefined | null,
    purpose: TokenPurpose
): number | null {
    if (!token) return null;
    const parts = token.split(".");

    let rawId: string;
    let rawTs: string;
    let sig: string;
    let maxAgeMs: number;

    if (purpose === "2fa") {
        // Só o formato com prefixo serve aqui: token de sessão inteira é recusado.
        if (parts.length !== 4 || parts[0] !== TWOFA_PREFIX) return null;
        [, rawId, rawTs, sig] = parts;
        maxAgeMs = TWOFA_MAX_AGE_MS;
    } else {
        // Só o formato sem prefixo: token de "meio login" é recusado.
        if (parts.length !== 3) return null;
        [rawId, rawTs, sig] = parts;
        maxAgeMs = TOKEN_MAX_AGE_MS;
    }

    const signedPayload =
        purpose === "2fa" ? `${TWOFA_PREFIX}.${rawId}.${rawTs}` : `${rawId}.${rawTs}`;
    if (!timingSafeEqual(sig, sign(signedPayload))) return null;

    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return null;

    // Token velho não vale mais, mesmo com assinatura boa.
    const ts = Number(rawTs);
    if (!Number.isFinite(ts) || ts <= 0) return null;
    if (Date.now() - ts > maxAgeMs) return null;

    return id;
}
