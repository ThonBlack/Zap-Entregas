/**
 * As regras da "Fila da loja" que não dependem de banco nenhum.
 *
 * Quem lê: a tela (pra decidir se desenha o botão) e o servidor (pra decidir se
 * obedece). É de propósito que seja o MESMO arquivo — a tela é só a primeira
 * barreira, e quando as duas réguas moram em lugares diferentes elas divergem.
 *
 * Sem `server-only`: os componentes de tela importam daqui. Este arquivo é PURO
 * (nada de banco), igual a wallet-shared, dailySeq-shared e chargeMode.
 */

/** As corridas que a fila mostra em "Na fila / em andamento". */
export const STATUS_ABERTOS_DA_FILA = ["pending", "assigned", "picked_up"] as const;

/**
 * O status em português, do jeito que o vendedor entende. Nada de "assigned" na
 * tela de quem está atendendo cliente no balcão.
 */
export const STATUS_FILA_LABEL: Record<string, string> = {
    draft: "Esperando conferência",
    pending: "Na fila, esperando motoboy",
    assigned: "Motoboy a caminho da loja",
    picked_up: "Saiu pra entregar",
    delivered: "Entregue",
    canceled: "Cancelada",
};

/**
 * Os campos que a fila lê de CADA corrida — a lista fechada, de propósito.
 *
 * Toda a tela é "sem nada de financeiro": o vendedor cuida do pedido, não do
 * acerto com o motoboy. Se a consulta trouxesse a corrida inteira, bastaria
 * alguém pôr um `{corrida.fee}` na tela um dia pra vazar o ganho do motoboy pro
 * painel do EpicStore — e ninguém repararia na revisão.
 *
 * Com a lista aqui, existe um teste que reclama se um campo de dinheiro da
 * operação entrar (scripts/test/fila.test.mjs).
 *
 * `value` está na lista e NÃO é dinheiro da operação: é quanto o cliente paga,
 * que é justamente o que o vendedor precisa conferir.
 */
export const COLUNAS_DA_FILA = {
    id: true,
    status: true,
    dailySeq: true,
    customerName: true,
    customerPhone: true,
    address: true,
    value: true,
    chargeMode: true,
    observation: true,
    motoboyId: true,
    geoPrecision: true,
    lat: true,
    lng: true,
    createdAt: true,
    pickedUpAt: true,
    deliveredAt: true,
} as const;

/**
 * O que a fila NUNCA carrega: taxa do motoboy, recibo, carteira, correção de
 * fechamento. É o acerto de contas entre a loja e o motoboy — não é assunto de
 * quem está no balcão.
 */
export const CAMPOS_FINANCEIROS_FORA_DA_FILA = [
    "fee",
    "receiptStatus",
    "receivedAmount",
    "receivedMethod",
    "receiptNote",
    "adjustedBy",
    "adjustedAt",
] as const;

/** Só o essencial pra decidir — assim dá pra testar sem montar banco. */
export type CorridaDaFila = {
    status: string;
    pickedUpAt?: string | null;
};

/**
 * Dá pra CORRIGIR esta corrida (endereço, cliente, valor)?
 *
 * Enquanto o pedido ainda está na loja: na fila (`pending`) ou já no nome de um
 * motoboy que ainda não veio buscar (`assigned`). Depois que ele coletou, a
 * mercadoria saiu — mudar o endereço por baixo mandaria o motoboy pra um lugar
 * diferente do que ele combinou, sem ele saber.
 *
 * O `pickedUpAt` é conferido junto com o status porque corrida antiga pode ter
 * o carimbo da coleta sem ter mudado de status direito.
 */
export function podeEditarNaFila(corrida: CorridaDaFila): boolean {
    if (corrida.pickedUpAt) return false;
    return corrida.status === "pending" || corrida.status === "assigned";
}

/**
 * Dá pra CANCELAR esta corrida?
 *
 * Mesma janela da edição, mais o rascunho que ainda nem foi conferido. Corrida
 * coletada, entregue ou já cancelada não se cancela — no primeiro caso porque o
 * pedido está na rua, nos outros porque não há o que desfazer.
 */
export function podeCancelarNaFila(corrida: CorridaDaFila): boolean {
    if (corrida.status === "draft") return true;
    return podeEditarNaFila(corrida);
}

/**
 * Carimbo de quem fez, no estilo que o app já usa ("finalizada pela loja
 * (Maria)", "destinada pela loja a João").
 *
 * Sem nome do operador não inventa carimbo: o EpicStore pode não saber quem
 * está no caixa, e "lançada pela loja ()" não ajuda ninguém.
 */
export function carimboDaFila(
    textoAtual: string | null | undefined,
    acao: string,
    operatorName: string | null | undefined,
    limite = 1000,
): string | null {
    const nome = typeof operatorName === "string" ? operatorName.trim() : "";
    const base = typeof textoAtual === "string" ? textoAtual.trim() : "";
    if (!nome) return base || null;

    const marca = `${acao} pela loja (${nome})`;
    return [base, marca].filter(Boolean).join(" · ").slice(0, limite) || null;
}
