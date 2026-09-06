/**
 * Endereço público do app — a única fonte da verdade pra montar link nosso.
 *
 * POR QUE NÃO USAR `request.url`:
 * em produção o app roda dentro de um container Docker, atrás do nginx. Lá
 * dentro o servidor se enxerga como `https://localhost:3000` — esse é o endereço
 * que ele escuta, não o que a pessoa digitou no navegador. Então
 * `new URL("/login", request.url)` vira `https://localhost:3000/login` e o
 * navegador do usuário tenta abrir a máquina DELE: erro de conexão.
 *
 * Também NÃO serve NEXT_PUBLIC_*: esses valores são congelados quando a imagem é
 * construída (na máquina do dev). APP_URL/OAUTH_BASE_URL são lidas em tempo de
 * execução, direto do compose da VPS.
 */

/** Base do site (sem barra no fim). Ex.: `https://zapentregas.duckdns.org` */
export function appBaseUrl(): string {
    const base =
        process.env.OAUTH_BASE_URL ||
        process.env.APP_URL ||
        "https://zapentregas.duckdns.org";
    return base.replace(/\/+$/, "");
}

/** Monta um endereço absoluto do próprio app. Ex.: `absoluteUrl("/login?erro=x")` */
export function absoluteUrl(path: string): URL {
    return new URL(path, `${appBaseUrl()}/`);
}
