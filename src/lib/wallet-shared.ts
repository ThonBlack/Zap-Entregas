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

/**
 * O que este lançamento faz com o saldo, escrito por extenso.
 *
 * O saldo é sempre do ponto de vista do MOTOBOY: crédito (+, verde) aumenta o
 * que a loja deve a ele; débito (−, vermelho) diminui. As duas telas que mostram
 * lançamento (extrato e confirmações pendentes) discordavam no sinal e na cor —
 * o mesmo "paguei R$ 300" aparecia "+300 verde" numa e "−300 vermelho" na outra.
 * Daqui pra frente as duas leem daqui.
 */
export function efeitoNoSaldo(
    type: "credit" | "debit",
    amount: number,
    quem: "motoboy" | "loja" = "motoboy",
): { sinal: "+" | "−"; cor: "green" | "red"; frase: string } {
    const valor = formatBRL(Math.abs(amount));
    if (type === "credit") {
        return {
            sinal: "+",
            cor: "green",
            frase: quem === "motoboy"
                ? `Aumenta ${valor} no que a loja te deve`
                : `Aumenta ${valor} no que você deve ao motoboy`,
        };
    }
    return {
        sinal: "−",
        cor: "red",
        frase: quem === "motoboy"
            ? `Abate ${valor} do que a loja te deve`
            : `Abate ${valor} do que você deve ao motoboy`,
    };
}

/** Mês/ano pedidos na URL, com o padrão sendo o mês ATUAL em Brasília (o servidor roda em UTC). */
export function parseMonth(sp: { m?: string; y?: string }) {
    const nowBrt = new Date(Date.now() - 3 * 3600 * 1000); // UTC−3, sem horário de verão
    const m = Number(sp.m), y = Number(sp.y);
    const okM = Number.isInteger(m) && m >= 1 && m <= 12;
    const okY = Number.isInteger(y) && y >= 2020 && y <= 2100;
    return { month: okM ? m : nowBrt.getUTCMonth() + 1, year: okY ? y : nowBrt.getUTCFullYear() };
}

/** Só aceita caminho interno ("/x"); barra dupla ("//host", "/\\host") vira redirect externo no navegador. */
export function safeReturnTo(v: unknown, fallback = "/app"): string {
    const s = typeof v === "string" ? v : "";
    return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}
