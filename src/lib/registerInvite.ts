import "server-only";

/**
 * Cadastro de lojista por convite.
 *
 * /register é público (o app é instalável e o link circula no WhatsApp). Quem
 * se cadastra como LOJISTA passa a ver endereço, telefone e dinheiro — não pode
 * sair de graça pra qualquer um que abra a URL. Então:
 *
 *   - a tela nasce em "Sou Motoboy" e nem mostra a opção de lojista;
 *   - a opção só aparece com ?convite_lojista=<REGISTER_SHOPKEEPER_CODE>;
 *   - a server action confere o código de novo (a tela não é a tranca).
 *
 * Sem REGISTER_SHOPKEEPER_CODE no ambiente, ninguém se cadastra como lojista —
 * é o admin quem cria pelo painel. Isso é de propósito: o padrão é fechado.
 *
 * Lida em tempo de execução (nada de NEXT_PUBLIC_): a imagem Docker é montada
 * fora do servidor e a env ficaria congelada dentro do pacote.
 */

export function codigoDeConviteConfigurado(): boolean {
    return !!(process.env.REGISTER_SHOPKEEPER_CODE || "").trim();
}

export function conviteDeLojistaValido(codigo: string | null | undefined): boolean {
    const esperado = (process.env.REGISTER_SHOPKEEPER_CODE || "").trim();
    if (!esperado) return false;
    return (codigo || "").trim() === esperado;
}
