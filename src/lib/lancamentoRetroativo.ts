/**
 * Lançamento atrasado — a corrida de terça, digitada na quinta.
 *
 * Por que existe: o formulário não tinha campo de data, então tudo nascia com a
 * data do dia da digitação. Quem lançou na quinta as corridas de terça e quarta
 * viu as três caírem na quinta: o Resumo do dia (que conta pelo dia de Brasília
 * de `delivered_at`) e o contador "Corrida N" (que conta pelo dia de
 * `created_at`) passaram a mostrar um dia que nunca existiu.
 *
 * Duas regras moram aqui, as duas puras (nada de banco), pra poderem ser
 * testadas sem subir o servidor — e pra a TELA usar a mesma régua do servidor:
 *
 *   1. `interpretarDataDaCorrida` — o que o campo "Data da corrida" quer dizer;
 *   2. `instanteDaFinalizacao`    — em que dia cai o "Marcar entregue" da loja.
 *
 * O fuso é sempre o de Brasília, pela régua de `src/lib/datetime.ts` (UTC−3
 * fixo, a mesma que o SQLite usa com `'-3 hours'`).
 */

import {
    diaBrasiliaDe,
    ehDiaISO,
    hojeBrasiliaISO,
    instanteNoDiaBrasilia,
    somaDiasISO,
    somaMinutos,
} from "@/lib/datetime";

/**
 * Até quantos dias pra trás dá pra lançar.
 *
 * 60 dias cobre com folga o "esqueci de lançar a semana passada" e ainda segura
 * o dedo escorregado que digitaria 2025 no lugar de 2026 — data velha demais
 * bagunçaria fechamento e carteira de um mês que já foi acertado.
 */
export const MAX_DIAS_ATRAS = 60;

export const AVISO_DATA_ILEGIVEL = "Data da corrida não entendida. Escolha um dia no calendário.";
export const AVISO_DATA_FUTURA = "A data da corrida não pode ser no futuro.";
export const AVISO_DATA_ANTIGA = `Só dá pra lançar corrida de até ${MAX_DIAS_ATRAS} dias atrás.`;

export type DataDaCorrida =
    | {
        ok: true;
        /** O dia de Brasília da corrida ("YYYY-MM-DD"). */
        dia: string;
        /** É de um dia que já passou? (muda carimbo, numeração e push) */
        retroativa: boolean;
        /**
         * O instante que vai pro banco (ISO, UTC): agora, quando é de hoje; o
         * dia escolhido com a hora de agora, quando é atrasada.
         */
        quandoISO: string;
    }
    | { ok: false; erro: string };

/**
 * O que o campo "Data da corrida" quer dizer.
 *
 * Vazio é hoje — é o comportamento de sempre, e é o caso de 99% dos cadastros.
 */
export function interpretarDataDaCorrida(
    bruto: unknown,
    agora: Date = new Date(),
): DataDaCorrida {
    // "Hoje" sai do próprio instante recebido (e não de um relógio escondido):
    // é o que deixa a regra testável com uma data fixa.
    const hoje = diaBrasiliaDe(agora) ?? hojeBrasiliaISO();

    // Campo ausente é "hoje"; qualquer outra coisa que não seja texto é lixo
    // (o formulário só manda texto) e vira erro na tela, nunca uma data chutada.
    if (bruto != null && typeof bruto !== "string") {
        return { ok: false, erro: AVISO_DATA_ILEGIVEL };
    }
    const texto = typeof bruto === "string" ? bruto.trim() : "";

    if (!texto) {
        return { ok: true, dia: hoje, retroativa: false, quandoISO: agora.toISOString() };
    }

    if (!ehDiaISO(texto)) return { ok: false, erro: AVISO_DATA_ILEGIVEL };
    // Datas em ISO comparam certo como texto ("2026-09-08" < "2026-09-19").
    if (texto > hoje) return { ok: false, erro: AVISO_DATA_FUTURA };
    if (texto < somaDiasISO(hoje, -MAX_DIAS_ATRAS)) return { ok: false, erro: AVISO_DATA_ANTIGA };

    if (texto === hoje) {
        return { ok: true, dia: hoje, retroativa: false, quandoISO: agora.toISOString() };
    }

    const quandoISO = instanteNoDiaBrasilia(texto, agora);
    // Não deveria acontecer (ehDiaISO já passou), mas erro na tela é melhor que
    // gravar a data errada calado.
    if (!quandoISO) return { ok: false, erro: AVISO_DATA_ILEGIVEL };

    return { ok: true, dia: texto, retroativa: true, quandoISO };
}

/**
 * Os limites do campo `<input type="date">` na tela — a MESMA régua do
 * servidor, pra ninguém ver "escolha aceita" e receber erro depois.
 */
export function limitesDoCampoData(hoje: string = hojeBrasiliaISO()): { min: string; max: string } {
    return { min: somaDiasISO(hoje, -MAX_DIAS_ATRAS), max: hoje };
}

/**
 * Em que instante a corrida foi entregue, na hora de marcar "entregue".
 *
 * O motoboy finaliza na rua, no dia da corrida: pra ele é sempre "agora".
 *
 * A LOJA (ou o admin) é quem finaliza corrida atrasada — e aí "agora" jogaria a
 * corrida de terça no Resumo do dia de quinta, que é exatamente o problema que
 * o lançamento atrasado veio resolver. Nesse caso a entrega cai no DIA DA
 * CORRIDA, um minuto depois da criação (pra ficar na ordem certa do dia e nunca
 * antes do próprio cadastro).
 */
export function instanteDaFinalizacao(entrada: {
    /** `created_at` da corrida, como está no banco (os dois formatos servem). */
    createdAt: string | Date | null | undefined;
    /** Quem clicou foi a loja/admin? O motoboy nunca retroage. */
    porLoja: boolean;
    agora?: Date;
}): string {
    const agora = entrada.agora ?? new Date();
    const agoraISO = agora.toISOString();
    if (!entrada.porLoja) return agoraISO;

    const diaDaCorrida = diaBrasiliaDe(entrada.createdAt);
    const hoje = diaBrasiliaDe(agora);
    // Sem data legível (ou corrida de hoje/do futuro): "agora" de sempre.
    if (!diaDaCorrida || !hoje || diaDaCorrida >= hoje) return agoraISO;

    return somaMinutos(entrada.createdAt, 1) ?? agoraISO;
}
