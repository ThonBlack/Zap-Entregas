/**
 * O rótulo "Corrida N" — a forma de falar da corrida que a loja já usa.
 *
 * No grupo de WhatsApp cada corrida do dia é anunciada como "Corrida 7". O app
 * passou a guardar esse número em `deliveries.daily_seq` (por loja, recomeçando
 * do 1 a cada dia de Brasília) e é aqui que ele vira texto — um lugar só, pra
 * card, histórico, resumo do dia, push, rastreio e extrato escreverem igual.
 *
 * Sem `server-only` de propósito: os componentes de tela importam daqui. Este
 * arquivo é PURO (nada de banco), igual a wallet-shared e dailyClosing-shared.
 */

import { diaBrasiliaDe, fmtDiaCurto } from "@/lib/datetime";

/** O número é utilizável? (corrida antiga e rascunho vêm sem, e aí não há rótulo.) */
export function temNumeroDoDia(dailySeq: number | null | undefined): dailySeq is number {
    return typeof dailySeq === "number" && Number.isFinite(dailySeq) && dailySeq > 0;
}

/**
 * "Corrida 7" — ou `null` quando a corrida não tem número (rascunho, ou linha
 * antiga que o backfill não alcançou). Quem chama decide o que fazer com o
 * `null`; a regra do app é simplesmente não mostrar o rótulo.
 */
export function rotuloCorrida(dailySeq: number | null | undefined): string | null {
    return temNumeroDoDia(dailySeq) ? `Corrida ${dailySeq}` : null;
}

/**
 * "Corridas 7 a 9" — a rota com várias paradas vira uma faixa de números.
 * Devolve `null` quando algum dos dois não tem número, e "Corrida 7" quando os
 * dois são o mesmo.
 */
export function faixaDeCorridas(
    primeiro: number | null | undefined,
    ultimo: number | null | undefined,
): string | null {
    if (!temNumeroDoDia(primeiro) || !temNumeroDoDia(ultimo)) return null;
    return primeiro === ultimo ? `Corrida ${primeiro}` : `Corridas ${primeiro} a ${ultimo}`;
}

/**
 * "Corrida 7 do dia 14/09" — a versão com data, pro extrato da carteira, que é
 * lido dias depois (sem o dia, "Corrida 7" seria ambíguo: tem uma por dia).
 *
 * `quando` é a data do banco (UTC, nos dois formatos); o dia sai em Brasília.
 * Sem número — ou sem data que dê pra ler — devolve `null`, e quem chama cai no
 * "#id" de sempre.
 */
export function rotuloCorridaComDia(
    dailySeq: number | null | undefined,
    quando: string | Date | null | undefined,
): string | null {
    const rotulo = rotuloCorrida(dailySeq);
    if (!rotulo) return null;
    const dia = diaBrasiliaDe(quando);
    return dia ? `${rotulo} do dia ${fmtDiaCurto(dia)}` : rotulo;
}

/**
 * Como a corrida é chamada no extrato: "Corrida 7 do dia 14/09" quando tem
 * número, "Corrida #135" (o id do banco) quando não tem.
 *
 * O extrato é lido por gente, não por máquina — por isso o número do dia vem na
 * frente e o id só aparece quando não há alternativa.
 */
export function nomeDaCorridaNoExtrato(
    id: number,
    dailySeq: number | null | undefined,
    quando: string | Date | null | undefined,
): string {
    return rotuloCorridaComDia(dailySeq, quando) ?? `Corrida #${id}`;
}
