/**
 * Tipo de cobrança da corrida — a régua ÚNICA, usada pelo servidor e pela tela.
 *
 * Antes existia só `value > 0` = "o motoboy cobra do cliente". Isso confundia
 * dois casos bem diferentes:
 *
 *   receber  → o motoboy cobra R$ X do cliente na entrega (dinheiro/cartão/PIX
 *              dele). O que ele receber em ESPÉCIE vira débito na carteira.
 *   conferir → o cliente disse que paga no PIX DA LOJA. O motoboy só CONFERE se
 *              o PIX caiu antes de entregar — o dinheiro nem passa pela mão
 *              dele, então não gera débito. Se na porta o cliente resolver pagar
 *              em dinheiro pro motoboy, aí sim entra na carteira, igual a uma
 *              corrida "a receber".
 *   pago     → não tem nada a receber.
 *
 * Sem `server-only` de propósito: os componentes de tela importam daqui.
 */

export const CHARGE_MODES = ["receber", "conferir", "pago"] as const;
export type ChargeMode = (typeof CHARGE_MODES)[number];

export function ehChargeMode(v: unknown): v is ChargeMode {
    return typeof v === "string" && (CHARGE_MODES as readonly string[]).includes(v);
}

/** O modo em que a cobrança ainda está aberta (tem valor pra receber ou conferir). */
export function cobra(modo: ChargeMode | null | undefined): boolean {
    return modo === "receber" || modo === "conferir";
}

/**
 * Régua antiga, pra quem não manda o campo (PDV velho, corrida gravada antes da
 * coluna existir): `value > 0` é "a receber", o resto é "já pago".
 */
export function chargeModePeloValor(value: number | null | undefined): ChargeMode {
    return value != null && value > 0 ? "receber" : "pago";
}

/**
 * Lê o que veio de fora (webhook do PDV, formulário) e devolve um modo válido.
 * Campo ausente ou lixo cai na régua antiga — nunca estoura.
 */
export function normalizarChargeMode(
    bruto: unknown,
    value: number | null | undefined,
): ChargeMode {
    if (ehChargeMode(bruto)) return bruto;
    if (typeof bruto === "string") {
        // O PDV pode mandar em português ("a receber", "conferir pix", "pago").
        const t = bruto.trim().toLowerCase();
        if (/receb/.test(t)) return "receber";
        if (/confer/.test(t)) return "conferir";
        if (/pago|pag[ou]/.test(t)) return "pago";
    }
    return chargeModePeloValor(value);
}

/**
 * O modo de uma corrida já gravada. Linha antiga (coluna NULL) cai na régua
 * velha, então nada muda de comportamento pra quem já estava no ar.
 */
export function chargeModeDaCorrida(
    corrida: { chargeMode?: string | null; value?: number | null },
): ChargeMode {
    return ehChargeMode(corrida.chargeMode)
        ? corrida.chargeMode
        : chargeModePeloValor(corrida.value);
}

export const CHARGE_MODE_LABEL: Record<ChargeMode, string> = {
    receber: "Receber na entrega",
    conferir: "Conferir Pix da loja",
    pago: "Já pago",
};

export const CHARGE_MODE_AJUDA: Record<ChargeMode, string> = {
    receber: "O motoboy cobra o valor do cliente na porta.",
    conferir: "O cliente paga no Pix da loja. O motoboy só confere se caiu antes de entregar.",
    pago: "Não tem nada a receber — o motoboy só entrega.",
};

/** Dinheiro na tela é sempre "150,50" — nunca "150.5". */
function reais(n: number): string {
    return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

/**
 * A etiqueta que o motoboy lê no card: "💵 Receber R$ 12,50",
 * "🔎 Conferir Pix R$ 12,50" ou "✅ Pago".
 *
 * `value` nulo é a loja escondendo o valor do motoboy (ou corrida de outra
 * loja ainda mascarada): aí some só o número, não o aviso.
 */
export function rotuloCobranca(
    modo: ChargeMode,
    value: number | null | undefined,
): string {
    const temValor = value != null && value > 0;
    if (modo === "receber") return temValor ? `💵 Receber ${reais(value!)}` : "💵 Receber do cliente";
    if (modo === "conferir") return temValor ? `🔎 Conferir Pix ${reais(value!)}` : "🔎 Conferir Pix da loja";
    return "✅ Pago";
}

/** Cor da etiqueta no fundo escuro do app. */
export function tomCobranca(modo: ChargeMode): string {
    if (modo === "receber") return "bg-amber-900/40 text-amber-200 border-amber-700/50";
    if (modo === "conferir") return "bg-sky-900/40 text-sky-200 border-sky-700/50";
    return "bg-emerald-900/40 text-emerald-200 border-emerald-700/50";
}
