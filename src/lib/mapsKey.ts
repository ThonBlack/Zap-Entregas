/**
 * Chave do Google que pode ir pro navegador (Maps JavaScript API).
 *
 * É OUTRA chave, não a GOOGLE_MAPS_API_KEY: essa é do servidor (geocode e Places)
 * e não pode sair daqui. A do navegador tem que estar restrita por site no console
 * do Google — assim, mesmo aparecendo no HTML, ninguém usa fora do nosso domínio.
 *
 * Sem NEXT_PUBLIC_*: a imagem Docker é montada aqui no PC e uma env NEXT_PUBLIC_
 * ficaria congelada dentro do pacote. Lida em runtime, trocar a chave é mexer no
 * .env do servidor e reiniciar o container.
 *
 * Só chame de server component / route handler.
 */
export function getBrowserMapsKey(): string | null {
    const chave = process.env.GOOGLE_MAPS_BROWSER_KEY?.trim();
    return chave ? chave : null;
}
