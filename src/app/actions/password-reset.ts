"use server";

import { db } from "../../db";
import { users, passwordResets } from "../../db/schema";
import { eq, or, and, isNull } from "drizzle-orm";
import { generateSecureToken, getTokenExpirationDate, isTokenExpired, hashPassword } from "../../lib/password";
import { sendPasswordResetEmail } from "../../lib/email";

/**
 * Solicita recuperação de senha via email ou telefone
 * Retorna sempre mensagem genérica por segurança (não revela se usuário existe)
 */
export async function requestPasswordResetAction(identifier: string) {
    // Busca usuário por telefone ou email
    const user = await db.select().from(users).where(
        or(
            eq(users.phone, identifier),
            eq(users.email, identifier)
        )
    ).get();

    // Se usuário não encontrado ou sem email, retorna sucesso genérico
    if (!user || !user.email) {
        // Log para admin (não revela ao usuário)
        console.log(`[Password Reset] Tentativa para identificador não encontrado ou sem email: ${identifier}`);
        return {
            success: true,
            message: "Se esse telefone/email estiver cadastrado, você receberá um link de recuperação."
        };
    }

    // Gera token seguro
    const token = generateSecureToken();
    const expiresAt = getTokenExpirationDate();

    // Salva token no banco
    await db.insert(passwordResets).values({
        userId: user.id,
        token,
        expiresAt,
    });

    // Monta URL de reset
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/login/reset-password?token=${token}`;

    // Envia email
    const emailSent = await sendPasswordResetEmail(user.email, resetUrl, user.name);

    if (!emailSent) {
        console.error(`[Password Reset] Falha ao enviar email para: ${user.email}`);
    }

    // Log de sucesso
    console.log(`[Password Reset] Token gerado para usuário ID ${user.id}, email: ${user.email}`);
    console.log(`[Password Reset] URL (debug): ${resetUrl}`);

    return {
        success: true,
        message: "Se esse telefone/email estiver cadastrado, você receberá um link de recuperação."
    };
}

/**
 * Redefine a senha usando o token
 */
export async function resetPasswordAction(token: string, newPassword: string) {
    if (!token || !newPassword) {
        return { error: "Token e nova senha são obrigatórios." };
    }

    if (newPassword.length < 4) {
        return { error: "A senha deve ter pelo menos 4 caracteres." };
    }

    // Busca token válido (não usado)
    const resetRequest = await db.select().from(passwordResets).where(
        and(
            eq(passwordResets.token, token),
            isNull(passwordResets.usedAt)
        )
    ).get();

    if (!resetRequest) {
        return { error: "Link inválido ou já utilizado." };
    }

    // Verifica expiração
    if (isTokenExpired(resetRequest.expiresAt)) {
        return { error: "Link expirado. Solicite um novo link de recuperação." };
    }

    // Hash da nova senha
    const hashedPassword = await hashPassword(newPassword);

    // Atualiza senha do usuário
    await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, resetRequest.userId));

    // Marca token como usado
    await db.update(passwordResets)
        .set({ usedAt: new Date().toISOString() })
        .where(eq(passwordResets.id, resetRequest.id));

    console.log(`[Password Reset] Senha atualizada para usuário ID ${resetRequest.userId}`);

    return { success: true, message: "Senha redefinida com sucesso! Você já pode fazer login." };
}

/**
 * Valida se um token é válido (sem usar)
 */
export async function validateResetTokenAction(token: string) {
    if (!token) {
        return { valid: false, error: "Token não fornecido." };
    }

    const resetRequest = await db.select().from(passwordResets).where(
        and(
            eq(passwordResets.token, token),
            isNull(passwordResets.usedAt)
        )
    ).get();

    if (!resetRequest) {
        return { valid: false, error: "Link inválido ou já utilizado." };
    }

    if (isTokenExpired(resetRequest.expiresAt)) {
        return { valid: false, error: "Link expirado." };
    }

    return { valid: true };
}
