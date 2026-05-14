import bcrypt from "bcryptjs";
import crypto from "crypto";

const SALT_ROUNDS = 10;

/**
 * Gera hash bcrypt de uma senha
 */
export async function hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Verifica senha contra hash bcrypt.
 * Senhas em texto plano (legado) NÃO são mais aceitas — usuários precisarão usar reset.
 */
export async function verifyPassword(plainPassword: string, storedPassword: string): Promise<boolean> {
    if (!storedPassword || !storedPassword.startsWith("$2")) {
        return false;
    }
    return bcrypt.compare(plainPassword, storedPassword);
}

export function isPasswordHashed(storedPassword: string): boolean {
    return !!storedPassword && storedPassword.startsWith("$2");
}

export function generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

export function getTokenExpirationDate(): string {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    return expiresAt.toISOString();
}

export function isTokenExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
}
