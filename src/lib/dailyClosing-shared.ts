// Parte do fechamento do dia que o navegador também usa — sem importar o banco.

export type ClosingStatus = "draft" | "sent" | "confirmed" | "disputed";

export const CLOSING_STATUS_LABEL: Record<ClosingStatus, string> = {
    draft: "Rascunho",
    sent: "Aguardando o motoboy",
    confirmed: "Confirmado pelo motoboy",
    disputed: "Contestado pelo motoboy",
};

export const RECEIPT_STATUS_LABEL: Record<string, string> = {
    recebido: "Recebeu",
    valor_diferente: "Recebeu valor diferente",
    nao_recebido: "Não recebeu",
    nada_a_receber: "Já estava pago",
};

export const RECEIPT_METHOD_LABEL: Record<string, string> = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    cartao: "Cartão",
};

/**
 * O líquido em português, sem sinal e sem jargão. `net` é sempre do ponto de
 * vista do motoboy (igual à carteira): >0 a loja deve a ele; <0 ele está com
 * dinheiro da loja no bolso.
 */
export function textoLiquido(net: number, quem: "loja" | "motoboy"): string {
    const valor = Math.abs(net).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (net > 0) {
        return quem === "loja"
            ? `A loja deve ${valor} ao motoboy`
            : `A loja te deve ${valor}`;
    }
    if (net < 0) {
        return quem === "loja"
            ? `O motoboy deve entregar ${valor} à loja`
            : `Você deve entregar ${valor} pra loja`;
    }
    return "Ninguém deve nada — o dia fechou certinho";
}

/** Cor do cartão do líquido: verde quando sobra pro motoboy, vermelho quando ele deve. */
export function tomLiquido(net: number): "green" | "red" | "zinc" {
    if (net > 0) return "green";
    if (net < 0) return "red";
    return "zinc";
}

/** Os totais que entram na comparação entre o congelado e o resumo vivo. */
export type TotaisFechamento = {
    deliveriesCount: number;
    feesTotal: number;
    cashTotal: number;
    pixTotal: number;
    cardTotal: number;
    net: number;
};

/** Meio centavo de folga pra não acusar divergência por lixo de ponto flutuante. */
const TOLERANCIA_CENTAVO = 0.005;

function difereDinheiro(a: number, b: number): boolean {
    return Math.abs(a - b) >= TOLERANCIA_CENTAVO;
}

/**
 * Compara os totais CONGELADOS de um fechamento (o que foi enviado ou já
 * confirmado) com o resumo VIVO (recalculado na hora) e diz quais campos
 * mudaram desde então. É o que acende o aviso "os números mudaram" na tela
 * da loja e a linha discreta no card do motoboy.
 */
export function fechamentoDivergente(
    congelado: TotaisFechamento,
    vivo: TotaisFechamento,
): { divergente: boolean; campos: string[] } {
    const campos: string[] = [];
    if (congelado.deliveriesCount !== vivo.deliveriesCount) campos.push("deliveriesCount");
    if (difereDinheiro(congelado.feesTotal, vivo.feesTotal)) campos.push("feesTotal");
    if (difereDinheiro(congelado.cashTotal, vivo.cashTotal)) campos.push("cashTotal");
    if (difereDinheiro(congelado.pixTotal, vivo.pixTotal)) campos.push("pixTotal");
    if (difereDinheiro(congelado.cardTotal, vivo.cardTotal)) campos.push("cardTotal");
    if (difereDinheiro(congelado.net, vivo.net)) campos.push("net");
    return { divergente: campos.length > 0, campos };
}
