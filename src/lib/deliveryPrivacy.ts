import { parseBrazilianAddress } from "@/lib/addressParser";

/**
 * O que um motoboy de OUTRA loja pode ver de uma corrida ainda não aceita.
 *
 * O pool é aberto de propósito: qualquer motoboy pode pegar qualquer corrida,
 * e é isso que faz a coisa girar quando a loja está sem gente. O problema é o
 * que estava junto no anúncio — nome, telefone e endereço completo do cliente
 * final de uma loja, na tela (e no celular, por notificação) de gente que não
 * tem relação nenhuma com aquela loja. Isso é dado pessoal de terceiro.
 *
 * Então o anúncio passa a mostrar só o que serve pra DECIDIR: em que bairro é,
 * em que cidade e de que loja veio. Aceitou, vira responsável pela entrega e aí
 * sim recebe nome, telefone e endereço com número.
 *
 * Vale só pro motoboy de outra loja: o da própria loja e o admin continuam
 * vendo tudo, como sempre viram.
 */

/**
 * "Centro · Uberaba" — o quanto dá pra contar sem entregar a casa de ninguém.
 *
 * Quando o endereço não tem bairro reconhecível, sobra a cidade; quando não tem
 * nem isso, é melhor dizer que só aparece depois do que inventar um lugar.
 */
export function resumoDoLocal(endereco: string | null | undefined): string {
    const partes = parseBrazilianAddress(endereco || "");
    const bairro = partes.neighborhood?.trim() || null;
    const cidade = partes.city?.trim() || null;

    if (bairro && cidade) return `${bairro} · ${cidade}`;
    if (bairro) return bairro;
    if (cidade) return cidade;

    // O leitor de endereço precisa de rua + número pra separar as partes. Quando
    // ele não separa (endereço curto, "Uberaba - MG"), a ÚLTIMA parte depois da
    // vírgula ainda é a cidade — nunca a rua, que vem sempre na frente. Sem
    // vírgula não dá pra ter certeza do que é, e aí é melhor não mostrar nada.
    const pedacos = (endereco || "").split(",").map((p) => p.trim()).filter(Boolean);
    const ultimo = pedacos.length >= 2 ? pedacos[pedacos.length - 1] : null;
    const semUf = ultimo?.replace(/\s*[-/]\s*[A-Z]{2}\s*$/i, "").trim();
    if (semUf && !/\d/.test(semUf)) return semUf;

    return "Endereço aparece quando você aceitar";
}

/**
 * Coordenada arredondada pra ~100 metros.
 *
 * O motoboy precisa saber se é perto ou longe pra decidir se pega — mas com a
 * coordenada exata o mapa aponta a porta da casa, e aí esconder o texto do
 * endereço não teria adiantado nada. Três casas decimais dão a quadra, não a
 * casa. Depois de aceitar, a coordenada exata volta.
 */
export function coordenadaAproximada(v: number | null | undefined): number | null {
    if (v == null || !Number.isFinite(v) || v === 0) return null;
    return Math.round(v * 1000) / 1000;
}

export type CorridaMascaravel = {
    address: string;
    customerName: string | null;
    customerPhone: string | null;
    observation: string | null;
    lat: number | null;
    lng: number | null;
};

/**
 * Devolve a corrida como ela deve aparecer pra quem ainda não é dono dela.
 * `nomeDaLoja` entra pra pessoa saber de onde a corrida veio.
 */
export function mascararParaOutraLoja<T extends CorridaMascaravel>(
    corrida: T,
    nomeDaLoja: string | null,
): T & { shopName: string | null; masked: true } {
    return {
        ...corrida,
        address: resumoDoLocal(corrida.address),
        customerName: null,
        customerPhone: null,
        observation: null,
        lat: coordenadaAproximada(corrida.lat),
        lng: coordenadaAproximada(corrida.lng),
        shopName: nomeDaLoja,
        masked: true as const,
    };
}

/**
 * Texto curto do aviso de corrida nova (notificação no celular).
 *
 * O push saía com o endereço cru — dado pessoal saindo do app pra um aparelho
 * que a loja não controla, de gente que nem é da loja. Agora vai só o bairro.
 */
export function avisoDeCorridaNova(endereco: string | null | undefined): string {
    const resumo = resumoDoLocal(endereco);
    return resumo === "Endereço aparece quando você aceitar"
        ? "Abra o app pra ver os detalhes"
        : `Nova corrida em ${resumo}`;
}
