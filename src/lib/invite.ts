import "server-only";
import crypto from "node:crypto";
import { appBaseUrl } from "./appUrl";

/**
 * Convite do motoboy.
 *
 * O motoboy cadastrado pela loja não escolhe senha na hora do cadastro — quem
 * digita é o dono da loja, e uma senha que só o dono conhece não serve pra nada.
 * Então a conta nasce SEM senha e o motoboy recebe um link de uso único onde ele
 * mesmo cria a dele. Ao usar, o código é apagado e a pessoa já entra logada.
 */

/** Quantos dias o link vale antes de vencer. */
export const INVITE_DAYS = 7;

/** Onde o motoboy baixa o aplicativo Android. */
export const APK_URL = "https://zapentregas.duckdns.org/baixar/zap-entregas.apk";

/**
 * Endereço público do app, lido A CADA CHAMADA.
 *
 * NÃO usar NEXT_PUBLIC_*: esses valores são congelados quando a imagem é
 * construída (na máquina do dev) e o link do convite sairia apontando pro
 * localhost. APP_URL/OAUTH_BASE_URL vêm do compose da VPS, em tempo de execução.
 */
export function getAppBaseUrl(): string {
    return appBaseUrl();
}

/** 32 bytes aleatórios — impossível de adivinhar, seguro pra ir na URL. */
export function generateInviteToken(): string {
    return crypto.randomBytes(32).toString("base64url");
}

/** Data (ISO) em que o convite gerado agora vence. */
export function getInviteExpiration(): string {
    return new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** O convite já venceu? Sem data = trata como vencido. */
export function isInviteExpired(expiresAt: string | null | undefined): boolean {
    if (!expiresAt) return true;
    return new Date(expiresAt) < new Date();
}

/** Tem convite valendo agora? (usado pro selo "Convite pendente") */
export function hasPendingInvite(user: {
    inviteToken?: string | null;
    inviteTokenExpiresAt?: string | null;
}): boolean {
    return !!user.inviteToken && !isInviteExpired(user.inviteTokenExpiresAt);
}

export function buildInviteUrl(token: string): string {
    return `${getAppBaseUrl()}/convite/${token}`;
}

/**
 * Telefone no formato que o wa.me aceita: só dígitos, com o 55 do Brasil.
 * Retorna null se não der pra montar um número plausível.
 */
export function phoneToWhatsapp(phone: string | null | undefined): string | null {
    const digits = (phone || "").replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length < 10) return null;
    if (digits.startsWith("55") && digits.length >= 12) return digits;
    return `55${digits}`;
}

export function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] || name.trim();
}

/** A mensagem pronta que o dono da loja manda no WhatsApp. */
export function buildInviteMessage(
    motoboyName: string,
    shopName: string,
    inviteUrl: string
): string {
    return [
        `Oi ${firstName(motoboyName)}! Você foi cadastrado no Zap Entregas da ${shopName}.`,
        ``,
        `1) Baixe o app: ${APK_URL}`,
        ``,
        `2) Abra este link pra criar sua senha: ${inviteUrl}`,
    ].join("\n");
}

/** Link do WhatsApp já com a mensagem. Sem telefone válido, abre sem destinatário. */
export function buildWhatsappUrl(phone: string | null | undefined, message: string): string {
    const numero = phoneToWhatsapp(phone);
    const texto = encodeURIComponent(message);
    return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`;
}
