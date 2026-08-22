import { randomBytes } from "crypto";

// Token opaco para o link público de rastreio (substitui o ID sequencial,
// que permitia enumerar entregas de outros clientes).
export function newTrackingToken(): string {
    return randomBytes(12).toString("base64url");
}

/**
 * Código do link de conferência aberto pelo PDV.
 * Mais longo que o de rastreio porque ele autoriza EDITAR a corrida — não só ver.
 * Vale uma vez só e expira; quem confirma pelo PDV não tem login no Zap.
 */
export function newConfirmToken(): string {
    return randomBytes(24).toString("base64url");
}

/** Quanto tempo o link de conferência do PDV continua valendo. */
export const CONFIRM_TOKEN_TTL_MS = 1000 * 60 * 60 * 2;

export function confirmTokenExpiry(): string {
    return new Date(Date.now() + CONFIRM_TOKEN_TTL_MS).toISOString();
}
