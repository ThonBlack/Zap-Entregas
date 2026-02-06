import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 10;

/**
 * Gera hash seguro de uma senha usando bcrypt
 */
export async function hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Verifica se uma senha corresponde ao hash armazenado
 * Suporta tanto hashes bcrypt quanto senhas em texto plano (migração gradual)
 */
export async function verifyPassword(plainPassword: string, storedPassword: string): Promise<boolean> {
    // Se começa com $2 é hash bcrypt
    if (storedPassword.startsWith('$2')) {
        return bcrypt.compare(plainPassword, storedPassword);
    }
    // Senão, é senha em texto plano (legado) - comparação direta
    return plainPassword === storedPassword;
}

/**
 * Verifica se a senha armazenada é um hash bcrypt
 */
export function isPasswordHashed(storedPassword: string): boolean {
    return storedPassword.startsWith('$2');
}

/**
 * Gera um token seguro para reset de senha (32 bytes = 64 caracteres hex)
 */
export function generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Calcula a data de expiração do token (15 minutos a partir de agora)
 */
export function getTokenExpirationDate(): string {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    return expiresAt.toISOString();
}

/**
 * Verifica se um token expirou
 */
export function isTokenExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
}
