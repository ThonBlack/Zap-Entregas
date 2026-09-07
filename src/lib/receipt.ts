import { parseMoney } from "@/lib/money";

/**
 * O que o motoboy respondeu na hora de finalizar a entrega ("recebeu do cliente?").
 *
 * Fica fora do arquivo de ações do servidor pra poder ser conferido por teste,
 * e pra tela e servidor usarem exatamente a MESMA regra — antes a tela deixava
 * passar "recebi outro valor" com o campo em branco e o servidor gravava R$ 0,00.
 */
export interface DeliveryReceipt {
    status: "recebido" | "valor_diferente" | "nao_recebido" | "nada_a_receber";
    amount?: number; // quanto recebeu (recebido/valor_diferente)
    method?: "dinheiro" | "pix" | "cartao";
    note?: string;
}

export const RECEIPT_STATUSES = ["recebido", "valor_diferente", "nao_recebido", "nada_a_receber"] as const;
export const RECEIPT_METHODS = ["dinheiro", "pix", "cartao"] as const;

/** Teto de sanidade: acima disso é dedo escorregando no teclado. */
const VALOR_MAXIMO = 100000;

export const AVISO_VALOR_VAZIO =
    'Digite quanto você recebeu. Se não recebeu nada, escolha "Não recebi".';

export type RecebimentoValidado = {
    status: (typeof RECEIPT_STATUSES)[number];
    amount: number;
    method: (typeof RECEIPT_METHODS)[number] | null;
    note: string | null;
};

/**
 * Confere o que veio da tela. Devolve `{ error }` com a frase que o motoboy lê,
 * ou os valores já limpos e prontos pra gravar.
 */
export function validarRecebimento(
    receipt: DeliveryReceipt,
    /** Valor do pedido, usado quando ele diz "recebi o valor" certinho. */
    orderValue?: number | null
): { error: string } | RecebimentoValidado {
    if (!RECEIPT_STATUSES.includes(receipt.status)) {
        return { error: "Status de recebimento inválido." };
    }

    const note =
        typeof receipt.note === "string" && receipt.note.trim()
            ? receipt.note.trim().slice(0, 500)
            : null;

    if (receipt.status !== "recebido" && receipt.status !== "valor_diferente") {
        return { status: receipt.status, amount: 0, method: null, note };
    }

    // parseMoney entende "12,50" e "1.234,56"; Number() daria NaN nesses.
    const bruto = receipt.amount ?? (receipt.status === "recebido" ? orderValue ?? null : null);
    const amount = parseMoney(bruto);

    // "Recebi outro valor" com o campo em branco virava 0: a corrida fechava
    // com R$ 0,00, nenhum débito era criado e o dinheiro que ficou com o
    // motoboy sumia do acerto com a loja. Campo vazio e zero dão o mesmo aviso,
    // que é o que o motoboy precisa entender.
    if (receipt.status === "valor_diferente" && (amount === null || amount <= 0)) {
        return { error: AVISO_VALOR_VAZIO };
    }

    if (amount === null || amount < 0 || amount > VALOR_MAXIMO) {
        return { error: "Valor recebido inválido." };
    }

    if (!receipt.method || !RECEIPT_METHODS.includes(receipt.method)) {
        return { error: "Informe como recebeu (dinheiro, PIX ou cartão)." };
    }

    return { status: receipt.status, amount, method: receipt.method, note };
}
