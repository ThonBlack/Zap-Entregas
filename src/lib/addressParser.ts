/**
 * Quebra o endereço brasileiro em pedaços.
 *
 * O PDV do EpicStore manda neste formato:
 *   "Rua Vigário Silva, 143 - Centro - Uberaba/MG - CEP 38010-130 (Casa 2, fundos)"
 *
 * Jogar essa frase inteira num buscador de mapas não funciona: ele trata tudo como
 * texto corrido e não acha nada. Separando os campos, a busca acerta.
 */

export interface ParsedAddress {
    street: string | null;       // "Rua Vigário Silva"
    number: string | null;       // "143"
    neighborhood: string | null; // "Centro"
    city: string | null;         // "Uberaba"
    state: string | null;        // "MG"
    cep: string | null;          // "38010130" (só dígitos)
    complement: string | null;   // "Casa 2, fundos"
    /** Endereço limpo, sem CEP nem complemento — bom pra busca livre. */
    clean: string;
}

const UF = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/;

export function parseBrazilianAddress(raw: string): ParsedAddress {
    let texto = (raw || "").replace(/\s*\n+\s*/g, ", ").trim();

    // Complemento entre parênteses: "(Casa 328, alameda 10)" — atrapalha a busca.
    let complement: string | null = null;
    const parens = texto.match(/\(([^)]*)\)/);
    if (parens) {
        complement = parens[1].trim() || null;
        texto = texto.replace(parens[0], " ").trim();
    }

    // CEP, com ou sem a palavra "CEP", com ou sem hífen.
    let cep: string | null = null;
    const cepMatch = texto.match(/\b(?:CEP\s*:?\s*)?(\d{5})-?(\d{3})\b/i);
    if (cepMatch) {
        cep = cepMatch[1] + cepMatch[2];
        texto = texto.replace(cepMatch[0], " ");
    }
    texto = texto.replace(/\bCEP\b\s*:?/gi, " ");

    // UF: aceita "Uberaba/MG", "Uberaba - MG", "Uberaba, MG"
    let state: string | null = null;
    const ufMatch = texto.toUpperCase().match(UF);
    if (ufMatch) {
        state = ufMatch[1];
        // Tira só a ocorrência da sigla, preservando o resto do texto original.
        const i = texto.toUpperCase().lastIndexOf(state);
        texto = (texto.slice(0, i) + " " + texto.slice(i + state.length));
    }

    // Sobra algo como "Rua Vigário Silva, 143 - Centro - Uberaba"
    const partes = texto
        .split(/\s*[-–]\s*|\s*,\s*/)
        .map(p => p.replace(/^[\/\s]+|[\/\s]+$/g, "").trim())
        .filter(Boolean);

    let street: string | null = null;
    let number: string | null = null;
    let neighborhood: string | null = null;
    let city: string | null = null;

    if (partes.length) {
        street = partes[0];

        // O número costuma vir logo depois da rua; às vezes grudado nela.
        const idxNumero = partes.findIndex((p, i) => i > 0 && /^\d{1,6}[A-Za-z]?$/.test(p));
        if (idxNumero > 0) {
            number = partes[idxNumero];
            partes.splice(idxNumero, 1);
        } else {
            const grudado = street.match(/^(.*?)[,\s]+(\d{1,6}[A-Za-z]?)$/);
            if (grudado) { street = grudado[1].trim(); number = grudado[2]; }
        }

        const resto = partes.slice(1);
        if (resto.length === 1) {
            // Só sobrou um: pode ser bairro ou cidade — o chamador decide com a cidade da loja.
            neighborhood = resto[0];
        } else if (resto.length >= 2) {
            neighborhood = resto[0];
            city = resto[resto.length - 1];
        }
    }

    const clean = [
        [street, number].filter(Boolean).join(", "),
        neighborhood,
        city,
    ].filter(Boolean).join(" - ");

    return { street, number, neighborhood, city, state, cep, complement, clean };
}

/** Rua sem acento e sem abreviação — ajuda buscadores que casam texto ao pé da letra. */
export function normalizeStreet(street: string): string {
    return street
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\bR\.\s*/gi, "Rua ")
        .replace(/\bAv\.?\s*/gi, "Avenida ")
        .replace(/\bTv\.?\s*/gi, "Travessa ")
        .replace(/\bPç\.?\s*|\bPc\.?\s*/gi, "Praça ")
        .replace(/\bAl\.?\s*/gi, "Alameda ")
        .replace(/\s+/g, " ")
        .trim();
}
