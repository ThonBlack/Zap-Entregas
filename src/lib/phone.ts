/**
 * Telefone — uma régua só pro projeto inteiro.
 *
 * O mesmo celular chega escrito de mil jeitos: "(34) 99694-4103", "34996944103",
 * "+55 34 9694-4103", "5534996944103". Se cada tela gravar de um jeito, a pessoa
 * cadastrada por uma não consegue entrar pela outra.
 *
 * Regra do projeto:
 *   - GRAVAR sempre só dígitos, sem o 55 do Brasil → "34996802886"
 *   - PROCURAR aceitando todas as formas equivalentes (com/sem 55, com/sem o 9º dígito)
 */

/** Só os números do que a pessoa digitou. */
export function onlyDigits(value: string | null | undefined): string {
    return (value ?? "").replace(/\D/g, "");
}

/**
 * Formato de gravação: dígitos, sem zeros à esquerda e sem o 55 do Brasil.
 * "(34) 99694-4103" → "34996944103" | "+55 34 99694-4103" → "34996944103"
 */
export function normalizePhone(value: string | null | undefined): string {
    let d = onlyDigits(value).replace(/^0+/, "");
    // 55 + DDD + 8 ou 9 dígitos. Só corta quando o tamanho fecha, senão um número
    // que por acaso começa com 55 (ex.: DDD 55, Santa Maria/RS) seria mutilado.
    if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
    return d;
}

/** Um celular brasileiro plausível tem DDD + 8 (fixo/antigo) ou 9 dígitos. */
export function isPlausiblePhone(value: string | null | undefined): boolean {
    const d = normalizePhone(value);
    return d.length === 10 || d.length === 11;
}

/**
 * Todas as formas em que ESTE número pode estar gravado no banco.
 *
 * Serve pro login e pra checagem de "já existe": o motoboy cadastrado como
 * "3496944103" precisa entrar digitando "(34) 99694-4103" e vice-versa.
 * A ordem importa — do mais parecido com o que a pessoa digitou pro mais longe.
 */
export function phoneVariants(value: string | null | undefined): string[] {
    const out = new Set<string>();

    const raw = (value ?? "").trim();
    if (raw) out.add(raw); // como foi digitado (banco antigo pode ter máscara)

    const digits = onlyDigits(raw);
    if (digits) out.add(digits);

    const base = normalizePhone(raw);
    if (!base) return [...out];

    const formas = new Set<string>([base]);
    // 11 dígitos com 9 na frente do número → a versão sem o 9º dígito
    if (base.length === 11 && base[2] === "9") formas.add(base.slice(0, 2) + base.slice(3));
    // 10 dígitos → a versão com o 9º dígito
    if (base.length === 10) formas.add(base.slice(0, 2) + "9" + base.slice(2));

    for (const f of formas) {
        out.add(f);
        out.add(`55${f}`);
    }

    return [...out];
}

/**
 * Entre os usuários que casaram com alguma variante, qual é "o" usuário.
 * Prioriza o que está gravado exatamente como a pessoa digitou, depois o
 * formato canônico; só então cai em qualquer um (caso raro de duplicata).
 */
export function pickPhoneMatch<T extends { phone: string | null }>(
    candidatos: T[],
    digitado: string
): T | undefined {
    if (candidatos.length <= 1) return candidatos[0];
    const raw = digitado.trim();
    const base = normalizePhone(raw);
    return (
        candidatos.find((c) => c.phone === raw) ??
        candidatos.find((c) => c.phone === base) ??
        candidatos[0]
    );
}
