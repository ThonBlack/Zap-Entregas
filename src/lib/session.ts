import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
// Assinatura/leitura do token mora em sessionToken.ts (módulo puro, testável
// por script). É lá que fica a regra de "token de meio login não vale como sessão".
import { buildToken, parseToken } from "@/lib/sessionToken";

const COOKIE_NAME = "session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const TWOFA_COOKIE = "2fa_pending";
const TWOFA_MAX_AGE = 60 * 5;

function cookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax" as const,
        path: "/",
    };
}

export async function setSessionCookie(userId: number): Promise<void> {
    const store = await cookies();
    store.set(COOKIE_NAME, buildToken(userId, "session"), {
        ...cookieOptions(),
        maxAge: COOKIE_MAX_AGE,
    });
}

export async function clearSessionCookie(): Promise<void> {
    const store = await cookies();
    store.delete(COOKIE_NAME);
    store.delete(TWOFA_COOKIE);
}

export async function getSessionUserId(): Promise<number | null> {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    // "session": recusa de propósito um token de 2FA pendente colado aqui.
    return parseToken(token, "session");
}

export async function setTwoFactorPendingCookie(userId: number): Promise<void> {
    const store = await cookies();
    store.set(TWOFA_COOKIE, buildToken(userId, "2fa"), {
        ...cookieOptions(),
        maxAge: TWOFA_MAX_AGE,
    });
}

export async function getTwoFactorPendingUserId(): Promise<number | null> {
    const store = await cookies();
    const token = store.get(TWOFA_COOKIE)?.value;
    // "2fa": só o token de meio login serve, e só por 5 minutos.
    return parseToken(token, "2fa");
}

export async function clearTwoFactorPendingCookie(): Promise<void> {
    const store = await cookies();
    store.delete(TWOFA_COOKIE);
}

type Role = "admin" | "shopkeeper" | "motoboy";

export type SessionUser = {
    id: number;
    name: string;
    /** Vazio enquanto a conta criada pelo Google não completa o cadastro. */
    phone: string | null;
    role: Role;
    plan: string;
    subscriptionStatus: string;
    isActive: boolean | null;
};

async function loadSessionUser(userId: number): Promise<SessionUser | null> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            id: true,
            name: true,
            phone: true,
            role: true,
            plan: true,
            subscriptionStatus: true,
            isActive: true,
        },
    });
    if (!user) return null;
    if (user.isActive === false) return null;
    return user as SessionUser;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
    const id = await getSessionUserId();
    if (!id) return null;
    return loadSessionUser(id);
}

export async function requireUser(): Promise<SessionUser> {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    return user;
}

export async function requireRole(role: Role | Role[]): Promise<SessionUser> {
    const user = await requireUser();
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) redirect("/app");
    return user;
}

export async function requireAdmin(): Promise<SessionUser> {
    return requireRole("admin");
}

export async function requireShopkeeper(): Promise<SessionUser> {
    return requireRole(["shopkeeper", "admin"]);
}

export async function requireMotoboy(): Promise<SessionUser> {
    return requireRole(["motoboy", "admin"]);
}

export async function getAuthUser(): Promise<{ user: SessionUser } | { error: string }> {
    const user = await getCurrentUser();
    if (!user) return { error: "Não autenticado" };
    return { user };
}

export async function getAuthUserWithRole(
    role: Role | Role[]
): Promise<{ user: SessionUser } | { error: string }> {
    const auth = await getAuthUser();
    if ("error" in auth) return auth;
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(auth.user.role)) return { error: "Acesso negado" };
    return auth;
}
