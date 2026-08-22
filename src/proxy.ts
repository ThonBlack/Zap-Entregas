import { NextResponse, type NextRequest } from "next/server";

/**
 * Quem pode abrir páginas do Zap dentro de um quadro (iframe).
 * (No Next 16 este arquivo se chama "proxy"; era o antigo "middleware".)
 *
 * Fica aqui, e não no next.config, porque os cabeçalhos de lá são resolvidos
 * quando a imagem é construída — na máquina do dev — e a lista de domínios do
 * PDV nunca chegaria em produção. Aqui a variável é lida a cada requisição.
 *
 * PDV_FRAME_ANCESTORS: domínios separados por espaço, ex.:
 *   "https://vaporfume.shop https://epicstore.duckdns.org"
 */
export default function proxy(request: NextRequest) {
    const res = NextResponse.next();

    if (request.nextUrl.pathname.startsWith("/confirmar/")) {
        const permitidos = (process.env.PDV_FRAME_ANCESTORS || "").trim();
        res.headers.set(
            "Content-Security-Policy",
            `frame-ancestors 'self'${permitidos ? " " + permitidos : ""}`
        );
    } else {
        // O resto do app ninguém embute: evita esconder a tela real atrás de outra página.
        res.headers.set("X-Frame-Options", "SAMEORIGIN");
        res.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
    }

    return res;
}

export const config = {
    matcher: [
        // Tudo, menos arquivos estáticos e imagens — que não têm o que embutir.
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|wav|json|txt)$).*)",
    ],
};
