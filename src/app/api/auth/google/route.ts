import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, isGoogleLoginConfigured, newOauthState } from "@/lib/google-oauth";

/**
 * Manda a pessoa pro Google. O "state" vai junto e volta no callback:
 * é o que impede alguém de forjar um retorno de login.
 */
export async function GET(request: NextRequest) {
    if (!isGoogleLoginConfigured()) {
        return NextResponse.redirect(new URL("/login?erro=google_desligado", request.url));
    }

    const state = newOauthState();
    // "link=1" = a pessoa já está logada e está conectando a conta nas Configurações.
    const isLinking = request.nextUrl.searchParams.get("link") === "1";

    const res = NextResponse.redirect(buildAuthUrl(state));
    res.cookies.set("google_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 10,
    });
    res.cookies.set("google_oauth_mode", isLinking ? "link" : "login", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 10,
    });
    return res;
}
