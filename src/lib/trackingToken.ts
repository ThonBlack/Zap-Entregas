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

/**
 * Código da sessão da "Fila da loja" (a tela embutida no painel do EpicStore).
 *
 * Mesma força do código de conferência — 24 bytes de acaso — porque ele
 * autoriza mais ainda: não uma corrida, mas TODAS as corridas abertas da loja.
 * Adivinhar um destes é o mesmo que entrar no balcão.
 */
export function newQueueToken(): string {
    return randomBytes(24).toString("base64url");
}

/**
 * Quanto tempo a sessão da fila vale: 12 horas — um expediente inteiro.
 *
 * Longo de propósito. O caixa abre a tela de manhã e ela fica aberta o dia
 * todo; se vencesse em 2 horas, como o link de conferência, o vendedor perderia
 * a fila no meio do movimento. Quando vence, a tela avisa o EpicStore
 * (postMessage) e ele pede uma sessão nova sozinho.
 */
export const QUEUE_SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export function queueSessionExpiry(agora: Date = new Date()): string {
    return new Date(agora.getTime() + QUEUE_SESSION_TTL_MS).toISOString();
}
