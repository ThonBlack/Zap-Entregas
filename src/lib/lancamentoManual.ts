import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

import { MANUAL_ENTRY_OPTIONS, type ManualEntryKey } from "@/lib/wallet-shared";
import { parseMoney } from "@/lib/money";
import { interpretarDataDaCorrida } from "@/lib/lancamentoRetroativo";

/**
 * O lançamento manual na carteira do motoboy ("paguei", "ele me devolveu
 * dinheiro", bônus, cobrança, saldo inicial).
 *
 * Mora aqui, fora da server action, pelo mesmo motivo do fechamento de corrida
 * (src/lib/deliveryLedger.ts): assim a regra do dinheiro — o que é valor
 * válido, em que DIA o lançamento cai e quando ele é uma cópia do anterior —
 * pode ser testada sem subir o servidor nem forjar sessão.
 *
 * Quem decide QUEM pode lançar em QUEM continua na action (sessão + o guarda
 * de equipe do src/lib/team.ts). Aqui já chega autorizado.
 */

export const AVISO_CAMPOS = "Preencha motoboy, tipo e valor.";
export const AVISO_VALOR = "Valor inválido. Escreva assim: 1.850,00";
export const AVISO_REPETIDO =
    "Este mesmo lançamento acabou de ser salvo. Confira o extrato antes de repetir.";

/**
 * Quanto tempo em volta do carimbo conta como "é o mesmo lançamento".
 *
 * A janela é em volta do CARIMBO e não de "agora" por causa da data escolhida:
 * com um dia passado o carimbo vai pro passado, e um "agora − 60s" nunca mais
 * acharia a cópia. Dois envios seguidos do mesmo dia atrasado nascem com
 * segundos de diferença entre si, então continuam sendo pegos.
 */
export const JANELA_DE_REPETICAO_SEGUNDOS = 60;

export type EntradaManual = {
    /** Dono da carteira (já conferido pelo guarda de equipe). */
    motoboyId: number;
    /** Quem está lançando. */
    creatorId: number;
    /** O valor como a pessoa digitou ("1.850,00"). */
    valorDigitado: string;
    /** Qual das opções de MANUAL_ENTRY_OPTIONS. */
    entryKey: string;
    descricao?: string;
    /** Só entra no saldo depois que o motoboy aceitar. */
    precisaConfirmar?: boolean;
    /** O campo "Data" da tela: vazio = hoje. */
    dataDigitada?: unknown;
    /** Pra teste: o instante que vale como "agora". */
    agora?: Date;
};

export type ResultadoManual =
    | { ok: true; id: number; dia: string; quandoISO: string; retroativo: boolean }
    | { ok: false; erro: string };

/**
 * Grava o lançamento. Devolve o erro em português quando alguma coisa não
 * fecha — nada de exceção pra tela tratar.
 */
export async function registrarLancamentoManual(entrada: EntradaManual): Promise<ResultadoManual> {
    const entry = MANUAL_ENTRY_OPTIONS[entrada.entryKey as ManualEntryKey];
    if (!Number.isInteger(entrada.motoboyId) || entrada.motoboyId <= 0 || !entrada.valorDigitado || !entry) {
        return { ok: false, erro: AVISO_CAMPOS };
    }

    // `parseMoney` entende "1.850,00" (o conversor antigo lia R$ 1,85 e o acerto
    // do mês virava centavos). Texto ilegível é erro na tela, nunca zero.
    const amount = parseMoney(entrada.valorDigitado);
    if (amount === null || amount <= 0) {
        return { ok: false, erro: AVISO_VALOR };
    }

    // O campo "Data" (opcional): a devolução de sábado, lançada na segunda, tem
    // que contar no SÁBADO — senão o controle de quem devolveu quando mente. A
    // régua é a mesma do lançamento atrasado de corrida: vazio/hoje = agora;
    // dia passado = aquele dia com a hora de agora; futuro e velho demais são
    // recusados (e isto é conferido aqui no servidor, não só na tela).
    const data = interpretarDataDaCorrida(entrada.dataDigitada, entrada.agora ?? new Date());
    if (!data.ok) return { ok: false, erro: data.erro };

    // Trava de reenvio: o link "Acertar R$ X" é um GET com o valor na URL, então
    // apertar "voltar" no navegador reabre o formulário preenchido e salvava de
    // novo — dois pagamentos iguais na carteira. Lançamento idêntico (mesmo
    // motoboy, valor e tipo) a menos de um minuto deste é recusado.
    // `datetime()` normaliza os dois formatos de data que existem no banco.
    const janela = `${JANELA_DE_REPETICAO_SEGUNDOS} seconds`;
    const repetido = await db.query.transactions.findFirst({
        where: and(
            eq(transactions.userId, entrada.motoboyId),
            eq(transactions.amount, amount),
            eq(transactions.type, entry.type),
            eq(transactions.kind, entry.kind),
            sql`datetime(${transactions.createdAt}) >= datetime(${data.quandoISO}, '-' || ${janela})`,
            sql`datetime(${transactions.createdAt}) <= datetime(${data.quandoISO}, '+' || ${janela})`,
        ),
        columns: { id: true },
    });
    if (repetido) return { ok: false, erro: AVISO_REPETIDO };

    const descricao = (entrada.descricao ?? "").trim();
    const inserido = await db
        .insert(transactions)
        .values({
            userId: entrada.motoboyId,
            creatorId: entrada.creatorId,
            amount,
            type: entry.type,
            kind: entry.kind,
            description: descricao || entry.label,
            status: entrada.precisaConfirmar ? "pending" : "confirmed",
            // ISO explícito: o CURRENT_TIMESTAMP do banco grava noutro formato.
            // Sem data escolhida isto é "agora", como sempre foi.
            createdAt: data.quandoISO,
        })
        .returning({ id: transactions.id })
        .get();

    return {
        ok: true,
        id: Number(inserido?.id ?? 0),
        dia: data.dia,
        quandoISO: data.quandoISO,
        retroativo: data.retroativa,
    };
}
