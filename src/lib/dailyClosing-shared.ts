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
