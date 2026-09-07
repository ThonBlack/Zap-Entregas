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

    // Cabeçalhos de segurança básicos. Também estão no nginx da VPS
    // (nginx-zapentregas.conf) — repetidos aqui de propósito, pra continuarem
    // valendo se o servidor for reinstalado e alguém esquecer do vhost.
    //
    // HSTS: depois da primeira visita o navegador vai direto no https, sem nem
    //   tentar o http (fecha a brecha de quem digita o endereço num Wi-Fi
    //   público). Só tem efeito em resposta servida por https, então em
    //   desenvolvimento (http://localhost) o navegador ignora.
    // nosniff: o navegador respeita o tipo declarado do arquivo em vez de
    //   "adivinhar" que um upload é JavaScript.
    // Referrer-Policy: ao sair do site, o outro lado recebe só o domínio —
    //   nunca o link inteiro com o token de rastreio ou de conferência.
    res.headers.set("Strict-Transport-Security", "max-age=31536000");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

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
