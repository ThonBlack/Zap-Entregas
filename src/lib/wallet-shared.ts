// Parte da carteira que o navegador também usa — sem importar o banco.

export type TransactionKind = "corrida" | "dinheiro" | "pagamento" | "ajuste" | "abertura";

export const KIND_LABEL: Record<TransactionKind, string> = {
    corrida: "Corrida",
    dinheiro: "Dinheiro do cliente",
    pagamento: "Pagamento",
    ajuste: "Ajuste",
    abertura: "Saldo inicial",
};

/**
 * O que o lojista/admin pode lançar na carteira do motoboy. Cada opção já carrega
 * o sentido certo (credit/debit) — a tela não escolhe sinal, escolhe "o que aconteceu".
 * Regra de sinal em src/lib/wallet.ts.
 */
export const MANUAL_ENTRY_OPTIONS = {
    paguei: { kind: "pagamento", type: "debit", label: "Paguei o motoboy", hint: "Saiu do meu caixa pra ele (PIX, dinheiro). Reduz o que devo a ele." },
    recebi: { kind: "pagamento", type: "credit", label: "Motoboy me entregou dinheiro", hint: "Ele devolveu o dinheiro que segurou. Reduz o que ele me deve." },
    bonus: { kind: "ajuste", type: "credit", label: "A favor do motoboy", hint: "Bônus, corrida esquecida, gasolina. Aumenta o que devo a ele." },
    desconto: { kind: "ajuste", type: "debit", label: "Cobrar do motoboy", hint: "Desconto, prejuízo, adiantamento. Aumenta o que ele me deve." },
    abertura_devo: { kind: "abertura", type: "credit", label: "Saldo inicial: eu devo a ele", hint: "Use uma vez só, ao trazer a conta antiga pro app." },
    abertura_deve: { kind: "abertura", type: "debit", label: "Saldo inicial: ele me deve", hint: "Use uma vez só, ao trazer a conta antiga pro app." },
} as const;

export type ManualEntryKey = keyof typeof MANUAL_ENTRY_OPTIONS;

export function formatBRL(n: number) {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
