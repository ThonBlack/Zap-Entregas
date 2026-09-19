/**
 * De quem é a corrida que está sendo criada.
 *
 * Por que existe: o dono usa o app logado como ADMIN, e o cadastro gravava
 * `shopkeeper_id = id de quem clicou`. Corrida criada por ele nascia com
 * "loja = admin" em vez da loja de verdade — e aí não entrava no Resumo do dia
 * da loja, sumia do histórico dela e ganhava uma numeração "Corrida N" só dela.
 *
 * A decisão é pura (nada de banco) pra poder ser testada sem subir o servidor;
 * conferir se a loja existe e está ativa continua sendo trabalho do servidor
 * (src/lib/team.ts), porque isso só o banco sabe.
 *
 * Sem `server-only`: a tela do cadastro importa os avisos daqui.
 */

export const AVISO_ESCOLHA_A_LOJA = "Escolha a loja da corrida.";

export type Quem = {
    id: number;
    role: "admin" | "shopkeeper" | "motoboy";
};

export type EscolhaDeLoja =
    | { ok: true; shopkeeperId: number }
    | { ok: false; erro: string };

/**
 * Qual loja é a dona da corrida nova.
 *
 * Lojista: SEMPRE ele mesmo. O que vier no formulário é ignorado de propósito —
 * confiar no campo deixaria um lojista cadastrar corrida no nome de outro.
 *
 * Admin: a loja escolhida na tela, e ela é obrigatória. Melhor barrar com um
 * aviso claro do que gravar a corrida no nome errado, que é o estrago difícil
 * de desfazer depois (numeração e fechamento já andaram).
 */
export function lojaDaNovaCorrida(quem: Quem, shopIdBruto: unknown): EscolhaDeLoja {
    if (quem.role !== "admin") return { ok: true, shopkeeperId: quem.id };

    const id = Number(String(shopIdBruto ?? "").trim());
    if (!Number.isInteger(id) || id <= 0) return { ok: false, erro: AVISO_ESCOLHA_A_LOJA };
    return { ok: true, shopkeeperId: id };
}

/**
 * Esse motoboy pode receber uma corrida DESTA loja?
 *
 * Motoboy sem loja é o "da casa" (só o admin cadastra): serve pra qualquer uma.
 * Motoboy de outra loja, não — destinar a corrida a ele seria o mesmo furo que
 * o `shopkeeper_id` errado, só que na carteira.
 */
export function motoboyServeALoja(
    motoboy: { shopkeeperId?: number | null },
    shopkeeperId: number,
): boolean {
    const dele = motoboy.shopkeeperId ?? null;
    return dele == null || dele === shopkeeperId;
}
