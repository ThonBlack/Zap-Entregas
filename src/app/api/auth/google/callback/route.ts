import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { appLogs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { exchangeCodeForProfile, isGoogleLoginConfigured } from "@/lib/google-oauth";
import { resolverOuCriarUsuarioGoogle } from "@/lib/google-login";
import { pushToAdmins } from "@/lib/push";
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

    // --- Conectando a conta a partir das Configurações (pessoa já logada) ---
    if (mode === "link") {
        const meId = await getSessionUserId();
        if (!meId) return back("/login", "sessao_expirada");

        const jaVinculado = await db.query.users.findFirst({ where: eq(users.googleId, profile.sub) });
        if (jaVinculado && jaVinculado.id !== meId) return back("/settings", "google_em_uso");

        await db.update(users)
            .set({ googleId: profile.sub, email: profile.email })
            .where(eq(users.id, meId));

        return NextResponse.redirect(new URL("/settings?google=conectado", request.url));
    }

    // --- Entrando (ou criando conta) com Google ---
    // Conta nova nasce como motoboy: lojista e admin continuam vindo por telefone.
    const resultado = await resolverOuCriarUsuarioGoogle(profile);
    if (!resultado.ok) return back("/login", resultado.erro);

    const { user, contaNova } = resultado;

    if (contaNova) await avisarContaNova(user.id, user.name, profile.email);

    if (user.twoFactorEnabled && user.twoFactorSecret) {
        await setTwoFactorPendingCookie(user.id);
        return NextResponse.redirect(new URL("/login/2fa", request.url));
    }

    await setSessionCookie(user.id);

    // Sem telefone ainda (conta recém-criada pelo Google): pede antes de usar o app.
    const destino = user.phone ? "/app" : "/completar-cadastro";
    return NextResponse.redirect(new URL(destino, request.url));
}

/** Registra no log do app e cutuca os administradores. Nunca derruba o login. */
async function avisarContaNova(userId: number, nome: string, email: string): Promise<void> {
    try {
        await db.insert(appLogs).values({
            level: "info",
            event: "google_signup",
            message: `Motoboy novo pelo Google: ${nome}`,
            userId,
            page: "/api/auth/google/callback",
            metadata: JSON.stringify({ email, role: "motoboy" }),
        });
    } catch (e) {
        console.error("[GOOGLE] não consegui registrar o log da conta nova:", e);
    }

    try {
        await pushToAdmins({
            title: "Motoboy novo pelo Google",
            body: nome,
            url: `/admin/users/${userId}`,
            tag: `google-signup-${userId}`,
        });
    } catch (e) {
        console.error("[GOOGLE] não consegui avisar os admins:", e);
    }
}
