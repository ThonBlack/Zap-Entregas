/**
 * Limite de tentativas — em memória, por processo.
 *
 * O app não tinha nenhum: dava pra varrer senhas contra /login, adivinhar o
 * código de convite de lojista (que dá acesso a endereço, telefone e dinheiro),
 * varrer o código de 6 dígitos do segundo fator e inundar o webhook do PDV
 * (cada chamada dispara uma busca de endereço paga no Google).
 *
 * Janela DESLIZANTE: guarda o horário de cada tentativa e conta quantas caíram
 * dentro da janela. Assim não existe o efeito "vira a hora e libera tudo".
 *
 * Limitações assumidas de propósito:
 *  - vive na memória do processo, some no restart (é um Node só, atrás do nginx);
 *  - não é proteção contra ataque distribuído — é pra segurar força bruta comum.
 */

type Tentativas = number[]; // horários (Date.now()) das tentativas na janela

const registros = new Map<string, Tentativas>();

/** Teto de chaves guardadas — protege a memória de um ataque com IP variado. */
const MAX_CHAVES = 20000;
/** De quanto em quanto tempo varremos as chaves vencidas. */
const INTERVALO_DA_PODA_MS = 5 * 60 * 1000;
/** Nada fica guardado além disso (a maior janela usada é de 1 hora). */
const VIDA_MAXIMA_MS = 60 * 60 * 1000;

let ultimaPoda = Date.now();

function podar(agora: number): void {
    if (agora - ultimaPoda < INTERVALO_DA_PODA_MS) return;
    ultimaPoda = agora;
    for (const [chave, marcas] of registros) {
        const vivas = marcas.filter((t) => agora - t < VIDA_MAXIMA_MS);
        if (vivas.length) registros.set(chave, vivas);
        else registros.delete(chave);
    }
}

export type ResultadoDoLimite =
    | { permitido: true; restantes: number }
    | { permitido: false; esperarSegundos: number };

/**
 * Conta mais uma tentativa e diz se ela pode seguir.
 *
 * A tentativa é contada MESMO quando barrada: insistir enquanto está bloqueado
 * estica o bloqueio, que é o comportamento que a gente quer contra robô.
 */
export function registrarTentativa(
    chave: string,
    maximo: number,
    janelaMs: number,
    agora: number = Date.now(),
): ResultadoDoLimite {
    podar(agora);

    const anteriores = registros.get(chave) ?? [];
    const naJanela = anteriores.filter((t) => agora - t < janelaMs);
    naJanela.push(agora);

    // Chaves demais (IP variado de propósito): descarta a mais antiga pra não
    // deixar a memória crescer sem fim. Perder um contador antigo é aceitável.
    if (!registros.has(chave) && registros.size >= MAX_CHAVES) {
        const primeira = registros.keys().next();
        if (!primeira.done) registros.delete(primeira.value);
    }
    registros.set(chave, naJanela);

    if (naJanela.length > maximo) {
        const maisAntiga = naJanela[0];
        const esperar = Math.max(1, Math.ceil((janelaMs - (agora - maisAntiga)) / 1000));
        return { permitido: false, esperarSegundos: esperar };
    }

    return { permitido: true, restantes: maximo - naJanela.length };
}

/** Zera o contador — usar quando a tentativa deu certo (login ok, por exemplo). */
export function limparTentativas(chave: string): void {
    registros.delete(chave);
}

/** Só pros testes: começa do zero. */
export function zerarTudo(): void {
    registros.clear();
    // Zero e não Date.now(): assim a próxima chamada já poda, mesmo num teste que
    // usa um relógio fingido (números pequenos) em vez do horário de verdade.
    ultimaPoda = 0;
}

/** Quantas chaves estão guardadas agora (usado nos testes da poda). */
export function quantidadeDeChaves(): number {
    return registros.size;
}

/**
 * Mensagem pro usuário final, em PT-BR e sem jargão.
 * Arredonda pra cima em minutos quando passa de 1 minuto.
 */
export function mensagemDeEspera(esperarSegundos: number): string {
    if (esperarSegundos <= 90) {
        const s = Math.max(1, esperarSegundos);
        return `Muitas tentativas. Espere ${s} ${s === 1 ? "segundo" : "segundos"}.`;
    }
    const minutos = Math.ceil(esperarSegundos / 60);
    return `Muitas tentativas. Espere ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`;
}

/**
 * IP de quem chamou. Atrás do nginx o IP real é o PRIMEIRO da lista de
 * `x-forwarded-for` (os seguintes são os proxies do caminho).
 */
export function ipDeQuemChamou(cabecalhos: Headers | { get(nome: string): string | null }): string {
    const encaminhado = cabecalhos.get("x-forwarded-for");
    if (encaminhado) {
        const primeiro = encaminhado.split(",")[0]?.trim();
        if (primeiro) return primeiro.slice(0, 60);
    }
    const real = cabecalhos.get("x-real-ip");
    if (real) return real.trim().slice(0, 60);
    return "desconhecido";
}

// ── Regras de cada porta de entrada, num lugar só ───────────────────────────
const MIN = 60 * 1000;

export const LIMITES = {
    /** Login por IP e por telefone. */
    login: { maximo: 10, janelaMs: 15 * MIN },
    /** Código do segundo fator: 5 erros e o meio-login é descartado. */
    doisFatores: { maximo: 5, janelaMs: 15 * MIN },
    /** Aceitar convite de motoboy (a senha nasce aqui). */
    convite: { maximo: 10, janelaMs: 15 * MIN },
    /** Código de convite de lojista em /register — é o que "fecha" o cadastro. */
    conviteLojista: { maximo: 5, janelaMs: 60 * MIN },
    /** Pedido e uso de link de redefinição de senha. */
    senha: { maximo: 10, janelaMs: 15 * MIN },
    /** Webhook do PDV, por chave de API (loja movimentada manda muito). */
    webhookPdv: { maximo: 120, janelaMs: 1 * MIN },
    /** Busca de endereço (proxy do Google Places), por sessão/IP. */
    places: { maximo: 60, janelaMs: 1 * MIN },
} as const;

/** Atalho: aplica uma das regras acima. */
export function aplicarLimite(
    regra: keyof typeof LIMITES,
    identificador: string,
    agora?: number,
): ResultadoDoLimite {
    const { maximo, janelaMs } = LIMITES[regra];
    return registrarTentativa(`${regra}:${identificador}`, maximo, janelaMs, agora);
}

/** Zera o contador de uma regra (ex.: login que deu certo). */
export function limparLimite(regra: keyof typeof LIMITES, identificador: string): void {
    limparTentativas(`${regra}:${identificador}`);
}
