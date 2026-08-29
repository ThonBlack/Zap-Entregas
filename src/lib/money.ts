/**
 * Dinheiro que chega de fora (PDV, formulário) vem escrito como brasileiro
 * escreve: "12,50", "R$ 1.234,56". Number("12,50") dá NaN e a corrida entraria
 * com valor zero sem ninguém perceber.
 */

/**
 * Converte texto ou número em reais. Devolve `null` quando não dá pra entender
 * — quem chama decide se isso é 400 ou se cai no padrão.
 */
export function parseMoney(input: unknown): number | null {
    if (typeof input === "number") {
        return Number.isFinite(input) ? arredonda(input) : null;
    }
    if (typeof input !== "string") return null;

    let t = input.trim();
    if (!t) return null;

    t = t.replace(/R\$/gi, "").replace(/\s/g, "");
    // Com vírgula, ela é a casa decimal e o ponto é separador de milhar.
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");

    if (!/^-?\d+(\.\d+)?$/.test(t)) return null;

    const n = Number(t);
    return Number.isFinite(n) ? arredonda(n) : null;
}

function arredonda(n: number): number {
    return Math.round(n * 100) / 100;
}
