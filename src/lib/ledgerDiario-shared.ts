// Parte do controle diário que o navegador também usa — sem importar o banco.
//
// O problema que isto resolve, nas palavras do dono da loja: "não consigo
// rastrear fácil os dias em que o motoboy devolveu ou não dinheiro". O extrato
// mostra lançamento por lançamento; aqui cada DIA vira uma linha só, com quanto
// ele ganhou, quanto de dinheiro do cliente ficou com ele, quanto devolveu — e
// o saldo no fim daquele dia.
//
// Tudo aqui é PURO (nada de banco), pra poder ser testado sem subir servidor.
// Quem lê o banco é src/lib/ledgerDiario.ts.
//
// Régua de sinal: a MESMA da carteira (src/lib/wallet.ts), sempre do ponto de
// vista do motoboy — crédito aumenta o que a loja deve a ele, débito abate.

import { fmtDiaCurto, inicioDaSemanaISO, fimDaSemanaISO, somaDiasISO } from "@/lib/datetime";

/** Soma centavo a centavo sem herdar o lixo de ponto flutuante. */
function arredonda(n: number): number {
    return Math.round(n * 100) / 100;
}

/** Um dia de Brasília com movimento na carteira. */
export type DiaDoLedger = {
    /** O dia de Brasília, "YYYY-MM-DD". */
    dia: string;
    /** Quantas corridas entraram na carteira nesse dia. */
    corridas: number;
    /** Σ das taxas das corridas (credit/corrida) — o que ele ganhou. */
    ganho: number;
    /** Dinheiro do cliente que ficou na mão dele (debit/dinheiro). */
    dinheiroComEle: number;
    /** O que ELE entregou pra loja (credit/pagamento). */
    devolveu: number;
    /** O que a LOJA pagou pra ele (debit/pagamento). */
    lojaPagou: number;
    /** Ajustes e saldo inicial, já com sinal (crédito +, débito −). */
    ajustes: number;
    /** Quanto o saldo andou nesse dia. */
    variacao: number;
    /** Saldo da carteira no fim desse dia. */
    saldoNoFim: number;
};

/** Os mesmos números de um dia, somados num período (semana, mês, tela toda). */
export type TotaisDoLedger = {
    corridas: number;
    ganho: number;
    dinheiroComEle: number;
    devolveu: number;
    lojaPagou: number;
    ajustes: number;
    variacao: number;
};

export const TOTAIS_ZERADOS: TotaisDoLedger = {
    corridas: 0, ganho: 0, dinheiroComEle: 0, devolveu: 0, lojaPagou: 0, ajustes: 0, variacao: 0,
};

/**
 * O selo do dia, que é o que o dono da loja procura batendo o olho na lista.
 *
 *   nada_a_devolver → não ficou dinheiro de cliente com ele naquele dia
 *   devolveu        → entregou tudo (ou mais) do que ficou com ele
 *   devolveu_parte  → entregou uma parte
 *   nao_devolveu    → ficou com dinheiro e não entregou nada NAQUELE dia
 *
 * Cuidado ao ler: o selo é do DIA. Devolução costuma cobrir dias anteriores
 * ("ele devolveu R$ 140 esses dias"), então um "não devolveu" de terça pode já
 * ter sido pago na quinta. Quem conta a verdade do período é `faltaDevolver`.
 */
export type SeloDevolucao = "nada_a_devolver" | "devolveu" | "devolveu_parte" | "nao_devolveu";

export const SELO_DEVOLUCAO: Record<SeloDevolucao, { label: string; tom: "green" | "yellow" | "red" | "zinc" }> = {
    nada_a_devolver: { label: "Nada a devolver", tom: "zinc" },
    devolveu: { label: "Devolveu", tom: "green" },
    devolveu_parte: { label: "Devolveu parte", tom: "yellow" },
    nao_devolveu: { label: "Não devolveu", tom: "red" },
};

/** Meio centavo de folga: R$ 149,999 conta como devolveu os R$ 150. */
const TOLERANCIA_CENTAVO = 0.005;

export function classificarDevolucao(t: { dinheiroComEle: number; devolveu: number }): SeloDevolucao {
    if (t.dinheiroComEle <= TOLERANCIA_CENTAVO) return "nada_a_devolver";
    if (t.devolveu >= t.dinheiroComEle - TOLERANCIA_CENTAVO) return "devolveu";
    if (t.devolveu > TOLERANCIA_CENTAVO) return "devolveu_parte";
    return "nao_devolveu";
}

/**
 * Quanto do dinheiro do cliente ainda não voltou pra loja no período.
 *
 * É o número que interessa de verdade: o selo por dia mente quando a devolução
 * de quinta cobre a terça, este não. Nunca negativo — o que passou disso é
 * `devolveuAMais`.
 */
export function faltaDevolver(t: { dinheiroComEle: number; devolveu: number }): number {
    return arredonda(Math.max(0, t.dinheiroComEle - t.devolveu));
}

/** O contrário: ele entregou mais do que pegou no período (acerto de dia anterior). */
export function devolveuAMais(t: { dinheiroComEle: number; devolveu: number }): number {
    return arredonda(Math.max(0, t.devolveu - t.dinheiroComEle));
}

/** Soma os dias num total só. */
export function totaisDosDias(dias: DiaDoLedger[]): TotaisDoLedger {
    const t = { ...TOTAIS_ZERADOS };
    for (const d of dias) {
        t.corridas += d.corridas;
        t.ganho += d.ganho;
        t.dinheiroComEle += d.dinheiroComEle;
        t.devolveu += d.devolveu;
        t.lojaPagou += d.lojaPagou;
        t.ajustes += d.ajustes;
        t.variacao += d.variacao;
    }
    return {
        corridas: t.corridas,
        ganho: arredonda(t.ganho),
        dinheiroComEle: arredonda(t.dinheiroComEle),
        devolveu: arredonda(t.devolveu),
        lojaPagou: arredonda(t.lojaPagou),
        ajustes: arredonda(t.ajustes),
        variacao: arredonda(t.variacao),
    };
}

/** Uma semana ou um mês de movimento. */
export type PeriodoDoLedger = {
    /** Identificador estável: a segunda-feira ("2026-09-14") ou o mês ("2026-09"). */
    chave: string;
    /** O nome na tela: "14/09 a 20/09" ou "setembro/2026". */
    rotulo: string;
    /** Primeiro e último dia do período (mesmo que não tenham movimento). */
    inicio: string;
    fim: string;
    dias: DiaDoLedger[];
    totais: TotaisDoLedger;
    /** Saldo antes do primeiro dia do período. */
    saldoInicial: number;
    /** Saldo depois do último dia com movimento do período. */
    saldoFinal: number;
};

const MESES_LONGOS = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-09" → "setembro/2026". */
export function rotuloDoMes(chave: string): string {
    const mes = Number(chave.slice(5, 7));
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) return chave;
    return `${MESES_LONGOS[mes - 1]}/${chave.slice(0, 4)}`;
}

/** Último dia do mês "2026-09" → "2026-09-30". */
function ultimoDiaDoMes(chave: string): string {
    const ano = Number(chave.slice(0, 4));
    const mes = Number(chave.slice(5, 7));
    const proximo = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
    return somaDiasISO(proximo, -1);
}

type Balde = { chave: string; rotulo: string; inicio: string; fim: string };

/**
 * O motor dos dois agrupamentos: cada dia cai num balde, os baldes saem em
 * ordem e o saldo vai passando de um pro outro — o saldo final de uma semana é
 * o inicial da seguinte, sem recontar nada.
 */
function agrupar(
    dias: DiaDoLedger[],
    saldoInicial: number,
    balde: (dia: string) => Balde,
): PeriodoDoLedger[] {
    const ordenados = [...dias].sort((a, b) => a.dia.localeCompare(b.dia));
    const porChave = new Map<string, { balde: Balde; dias: DiaDoLedger[] }>();

    for (const d of ordenados) {
        const b = balde(d.dia);
        const atual = porChave.get(b.chave);
        if (atual) atual.dias.push(d);
        else porChave.set(b.chave, { balde: b, dias: [d] });
    }

    let saldo = arredonda(saldoInicial);
    const periodos: PeriodoDoLedger[] = [];
    for (const { balde: b, dias: doPeriodo } of porChave.values()) {
        const totais = totaisDosDias(doPeriodo);
        const saldoFinal = doPeriodo[doPeriodo.length - 1].saldoNoFim;
        periodos.push({
            chave: b.chave,
            rotulo: b.rotulo,
            inicio: b.inicio,
            fim: b.fim,
            dias: doPeriodo,
            totais,
            saldoInicial: saldo,
            saldoFinal,
        });
        saldo = saldoFinal;
    }
    return periodos;
}

/** Semanas de segunda a domingo, da mais antiga pra mais nova. */
export function agruparEmSemanas(dias: DiaDoLedger[], saldoInicial: number): PeriodoDoLedger[] {
    return agrupar(dias, saldoInicial, (dia) => {
        const inicio = inicioDaSemanaISO(dia);
        const fim = fimDaSemanaISO(dia);
        return { chave: inicio, rotulo: `${fmtDiaCurto(inicio)} a ${fmtDiaCurto(fim)}`, inicio, fim };
    });
}

/** Meses do calendário, do mais antigo pro mais novo. */
export function agruparEmMeses(dias: DiaDoLedger[], saldoInicial: number): PeriodoDoLedger[] {
    return agrupar(dias, saldoInicial, (dia) => {
        const chave = dia.slice(0, 7);
        return {
            chave,
            rotulo: rotuloDoMes(chave),
            inicio: `${chave}-01`,
            fim: ultimoDiaDoMes(chave),
        };
    });
}
