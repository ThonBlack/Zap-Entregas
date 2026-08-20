import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { exchangeCodeForProfile, isGoogleLoginConfigured } from "@/lib/google-oauth";
import { getSessionUserId, setSessionCookie, setTwoFactorPendingCookie } from "@/lib/session";

/** Volta do Google: identifica a pessoa e abre a sessão (ou conecta a conta). */
export async function GET(request: NextRequest) {
    const store = await cookies();
    const expectedState = store.get("google_oauth_state")?.value;
    const mode = store.get("google_oauth_mode")?.value === "link" ? "link" : "login";

    // Não deixar o state sobrando pro próximo login, dê certo ou não.
    store.delete("google_oauth_state");
    store.delete("google_oauth_mode");

    const back = (destino: string, erro?: string) =>
        NextResponse.redirect(new URL(erro ? `${destino}?erro=${erro}` : destino, request.url));

    const falhou = mode === "link" ? "/settings" : "/login";

    if (!isGoogleLoginConfigured()) return back(falhou, "google_desligado");

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    if (request.nextUrl.searchParams.get("error")) return back(falhou, "google_cancelado");
    if (!code || !state || !expectedState || state !== expectedState) return back(falhou, "google_state");

    const profile = await exchangeCodeForProfile(code);
    if (!profile) return back(falhou, "google_falhou");
    // E-mail não verificado no Google não serve pra provar identidade.
    if (!profile.emailVerified) return back(falhou, "google_email_nao_verificado");

    const jaVinculado = await db.query.users.findFirst({ where: eq(users.googleId, profile.sub) });

    // --- Conectando a conta a partir das Configurações (pessoa já logada) ---
    if (mode === "link") {
        const meId = await getSessionUserId();
        if (!meId) return back("/login", "sessao_expirada");
        if (jaVinculado && jaVinculado.id !== meId) return back("/settings", "google_em_uso");

        await db.update(users)
            .set({ googleId: profile.sub, email: profile.email })
            .where(eq(users.id, meId));

        return NextResponse.redirect(new URL("/settings?google=conectado", request.url));
    }

    // --- Entrando com Google ---
    let user = jaVinculado ?? null;

    // Sem vínculo ainda: aceita se o e-mail já estiver cadastrado nesse usuário.
    if (!user) {
        const porEmail = await db.query.users.findFirst({ where: eq(users.email, profile.email) });
        if (porEmail && !porEmail.googleId) {
            await db.update(users).set({ googleId: profile.sub }).where(eq(users.id, porEmail.id));
            user = { ...porEmail, googleId: profile.sub };
        }
    }

    // Conta nova nunca é criada por aqui: senão qualquer pessoa com Google entraria no app.
    if (!user) return back("/login", "google_sem_conta");
    if (user.isActive === false) return back("/login", "conta_desativada");

    if (user.twoFactorEnabled && user.twoFactorSecret) {
        await setTwoFactorPendingCookie(user.id);
        return NextResponse.redirect(new URL("/login/2fa", request.url));
    }

    await setSessionCookie(user.id);
    return NextResponse.redirect(new URL("/app", request.url));
}
