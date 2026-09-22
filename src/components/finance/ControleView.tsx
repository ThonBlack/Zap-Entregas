import Link from "next/link";
import { ChevronLeft, ChevronRight, HandCoins, Plus } from "lucide-react";

import { formatBRL } from "@/lib/wallet-shared";
import {
    SELO_DEVOLUCAO,
    agruparEmMeses,
    agruparEmSemanas,
    classificarDevolucao,
    devolveuAMais,
    faltaDevolver,
    totaisDosDias,
    type DiaDoLedger,
    type LedgerPorDia,
    type LinhaDeDevolucao,
    type PeriodoDoLedger,
    type TotaisDoLedger,
} from "@/lib/ledgerDiario-shared";
import { fmtDiaLegivel, fmtShortDateTime, hojeBrasilia } from "@/lib/datetime";
import { BalanceHeadline } from "@/components/finance/StatementView";

/**
 * Tela "Controle" — o dia a dia do dinheiro entre a loja e o motoboy.
 *
 * A mesma tela serve a loja e o motoboy; o que muda é o texto (`perspective`)
 * e os botões de lançar, que só a loja tem. As cores são todas escritas na mão
 * (o app já teve texto invisível em fundo escuro) e os botões têm 44px, porque
 * quem usa isto usa no celular.
 */

export type Visao = "dia" | "semana" | "mes";

const VISOES: { chave: Visao; label: string }[] = [
    { chave: "dia", label: "Dia" },
    { chave: "semana", label: "Semana" },
    { chave: "mes", label: "Mês" },
];

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Props = {
    ledger: LedgerPorDia;
    devolucoes: LinhaDeDevolucao[];
    visao: Visao;
    month: number;
    year: number;
    /** Rota da própria tela, pra montar ?v=&m=&y= */
    basePath: string;
    /** "motoboy" = fala "você"; "loja" = fala "ele" */
    perspective: "motoboy" | "loja";
    /** Link do dia pro Resumo do dia. Sem isto, a data não vira link (motoboy). */
    hrefDoDia?: (dia: string) => string;
    /** Botão "Registrar devolução". Só a loja lança. */
    hrefRegistrarDevolucao?: string;
    /**
     * Registrar a devolução DE UM DIA, já com a data e o valor sugerido.
     * Devolver `undefined` esconde o botão naquele dia (nada pendente).
     */
    hrefRegistrarDoDia?: (dia: DiaDoLedger) => string | undefined;
};

/** Mais que isto na lista de devoluções vira rolagem infinita no celular. */
const MAX_DEVOLUCOES = 60;

/**
 * Só a PRIMEIRA letra em maiúscula. O `capitalize` do CSS mexe em toda palavra
 * e escrevia "Sexta-Feira" e "14/09 A 20/09".
 */
function comMaiuscula(texto: string): string {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function ControleView({
    ledger, devolucoes, visao, month, year, basePath, perspective,
    hrefDoDia, hrefRegistrarDevolucao, hrefRegistrarDoDia,
}: Props) {
    const totais = totaisDosDias(ledger.dias);
    const head = BalanceHeadline({ balance: ledger.saldoAtual, perspective });
    const toneBg = {
        green: "bg-green-700 border-green-600",
        red: "bg-red-800 border-red-700",
        zinc: "bg-zinc-700 border-zinc-600",
    }[head.tone];

    const prev = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };
    const next = month === 12 ? { m: 1, y: year + 1 } : { m: month + 1, y: year };
    const hoje = hojeBrasilia();
    const temProximo = next.y < hoje.year || (next.y === hoje.year && next.m <= hoje.month);
    const link = (v: Visao, m: number, y: number) => `${basePath}?v=${v}&m=${m}&y=${y}`;

    const semanas = visao === "semana" ? [...agruparEmSemanas(ledger.dias, ledger.saldoInicial)].reverse() : [];
    const meses = visao === "mes" ? [...agruparEmMeses(ledger.dias, ledger.saldoInicial)].reverse() : [];
    const diasRecentesPrimeiro = [...ledger.dias].reverse();

    return (
        <div className="space-y-4">
            {/* Saldo de hoje */}
            <div className={`rounded-2xl border p-5 text-white ${toneBg}`}>
                <p className="text-xs uppercase tracking-wide opacity-80">{head.label}</p>
                <p className="text-3xl font-bold mt-1">{head.value}</p>
                <p className="text-xs opacity-80 mt-2">Saldo de hoje, com tudo que já foi confirmado.</p>
            </div>

            {/* Dia / Semana / Mês */}
            <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Como agrupar">
                {VISOES.map((v) => (
                    <Link
                        key={v.chave}
                        href={link(v.chave, month, year)}
                        aria-current={v.chave === visao ? "page" : undefined}
                        className={`min-h-11 flex items-center justify-center rounded-xl font-bold text-sm border ${v.chave === visao
                            ? "bg-green-600 border-green-500 text-white"
                            : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                            }`}
                    >
                        {v.label}
                    </Link>
                ))}
            </div>

            {/* Navegação de mês — o futuro não tem lançamento, então não tem pra onde ir */}
            <div className="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2">
                <Link
                    href={link(visao, prev.m, prev.y)}
                    className="min-h-11 min-w-11 flex items-center justify-center text-zinc-300 hover:text-white"
                    aria-label="Mês anterior"
                >
                    <ChevronLeft size={20} />
                </Link>
                <span className="font-bold text-white text-center px-1">
                    {visao === "mes" && <span className="block text-xs font-normal text-zinc-400">6 meses até</span>}
                    {MESES_CURTOS[month - 1]} / {year}
                </span>
                {temProximo ? (
                    <Link
                        href={link(visao, next.m, next.y)}
                        className="min-h-11 min-w-11 flex items-center justify-center text-zinc-300 hover:text-white"
                        aria-label="Próximo mês"
                    >
                        <ChevronRight size={20} />
                    </Link>
                ) : (
                    <span className="min-h-11 min-w-11 flex items-center justify-center text-zinc-700" aria-hidden="true">
                        <ChevronRight size={20} />
                    </span>
                )}
            </div>

            {/* O resumo do período inteiro que está na tela */}
            <ResumoDoPeriodo totais={totais} perspective={perspective} />

            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-300 flex items-center justify-between gap-2">
                <span>Saldo no início</span>
                <span className="font-mono text-white">{formatBRL(ledger.saldoInicial)}</span>
                <span className="text-zinc-500">→</span>
                <span>no fim</span>
                <span className="font-mono text-white">{formatBRL(ledger.saldoFinal)}</span>
            </div>

            {/* A lista, do jeito escolhido */}
            {visao === "dia" && (
                <div className="space-y-2">
                    {diasRecentesPrimeiro.length === 0 ? (
                        <Vazio />
                    ) : diasRecentesPrimeiro.map((d) => (
                        <CartaoDoDia
                            key={d.dia}
                            dia={d}
                            perspective={perspective}
                            href={hrefDoDia?.(d.dia)}
                            hrefRegistrar={hrefRegistrarDoDia?.(d)}
                        />
                    ))}
                </div>
            )}

            {visao === "semana" && (
                <div className="space-y-2">
                    {semanas.length === 0 ? <Vazio /> : semanas.map((s) => (
                        <CartaoDoPeriodo key={s.chave} periodo={s} perspective={perspective} />
                    ))}
                </div>
            )}

            {visao === "mes" && (
                <div className="space-y-2">
                    {meses.length === 0 ? <Vazio /> : meses.map((m) => (
                        <CartaoDoPeriodo key={m.chave} periodo={m} perspective={perspective} />
                    ))}
                </div>
            )}

            <Devolucoes
                devolucoes={devolucoes}
                total={totais.devolveu}
                perspective={perspective}
                hrefRegistrar={hrefRegistrarDevolucao}
            />
        </div>
    );
}

function Vazio() {
    return (
        <p className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 text-center text-zinc-400 text-sm">
            Nenhum movimento neste período.
        </p>
    );
}

/** Os números do período inteiro que está na tela. */
function ResumoDoPeriodo({ totais, perspective }: { totais: TotaisDoLedger; perspective: "motoboy" | "loja" }) {
    const falta = faltaDevolver(totais);
    const sobra = devolveuAMais(totais);
    const ele = perspective === "loja" ? "ele" : "você";

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
                <Cartao label={`Ganhou (${totais.corridas} ${totais.corridas === 1 ? "corrida" : "corridas"})`} valor={totais.ganho} cor="text-green-400" />
                <Cartao label={`Dinheiro que ficou com ${ele}`} valor={totais.dinheiroComEle} cor="text-red-400" />
                <Cartao label={perspective === "loja" ? "Ele devolveu" : "Você devolveu"} valor={totais.devolveu} cor="text-green-400" />
                <Cartao label={perspective === "loja" ? "A loja pagou a ele" : "A loja te pagou"} valor={totais.lojaPagou} cor="text-red-400" />
                {totais.ajustes !== 0 && (
                    <div className="col-span-2">
                        <Cartao
                            label="Ajustes"
                            valor={Math.abs(totais.ajustes)}
                            cor={totais.ajustes > 0 ? "text-green-400" : "text-red-400"}
                            prefixo={totais.ajustes > 0 ? "+" : "−"}
                        />
                    </div>
                )}
            </div>

            {/* O número que o dono da loja realmente procura */}
            <div className={`rounded-xl border p-4 ${sobra > 0
                ? "bg-green-600/10 border-green-600/50"
                : falta > 0
                    ? "bg-red-600/10 border-red-600/50"
                    : "bg-zinc-800 border-zinc-700"
                }`}>
                <p className="text-xs uppercase tracking-wide text-zinc-400">Dinheiro do cliente no período</p>
                <p className={`text-xl font-bold mt-1 ${sobra > 0 ? "text-green-300" : falta > 0 ? "text-red-300" : "text-white"}`}>
                    {sobra > 0
                        ? `Devolveu ${formatBRL(sobra)} a mais do que pegou`
                        : falta > 0
                            ? `Falta devolver ${formatBRL(falta)}`
                            : "Está tudo devolvido"}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                    {formatBRL(totais.dinheiroComEle)} de dinheiro do cliente − {formatBRL(totais.devolveu)} devolvidos.
                    A devolução pode cobrir dias anteriores, por isso este número vale mais que o selo de cada dia.
                </p>
            </div>
        </div>
    );
}

function Cartao({ label, valor, cor, prefixo }: { label: string; valor: number; cor: string; prefixo?: string }) {
    return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3">
            <div className="text-xs text-zinc-400">{label}</div>
            <div className={`font-mono font-bold ${cor}`}>{prefixo ?? ""}{formatBRL(valor)}</div>
        </div>
    );
}

const TOM_DO_SELO = {
    green: "bg-green-600/20 text-green-300 border-green-600/50",
    yellow: "bg-yellow-500/15 text-yellow-200 border-yellow-500/40",
    red: "bg-red-600/20 text-red-300 border-red-600/50",
    zinc: "bg-zinc-700 text-zinc-300 border-zinc-600",
} as const;

function Selo({ dia }: { dia: DiaDoLedger }) {
    const selo = SELO_DEVOLUCAO[classificarDevolucao(dia)];
    return (
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${TOM_DO_SELO[selo.tom]}`}>
            {selo.label}
        </span>
    );
}

function CartaoDoDia({
    dia, perspective, href, hrefRegistrar,
}: {
    dia: DiaDoLedger;
    perspective: "motoboy" | "loja";
    href?: string;
    hrefRegistrar?: string;
}) {
    const ele = perspective === "loja" ? "com ele" : "com você";
    const titulo = <span className="font-bold text-white">{comMaiuscula(fmtDiaLegivel(dia.dia))}</span>;

    return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                {href ? (
                    <Link href={href} className="min-h-11 flex items-center hover:underline text-white">
                        {titulo}
                    </Link>
                ) : (
                    <span className="min-h-11 flex items-center">{titulo}</span>
                )}
                <Selo dia={dia} />
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <span className="text-zinc-400">
                    {dia.corridas} {dia.corridas === 1 ? "corrida" : "corridas"} · ganhou
                </span>
                <span className="font-mono text-green-400 text-right">{formatBRL(dia.ganho)}</span>

                <span className="text-zinc-400">Dinheiro {ele}</span>
                <span className="font-mono text-red-400 text-right">{formatBRL(dia.dinheiroComEle)}</span>

                <span className="text-zinc-400">Devolveu</span>
                <span className="font-mono text-green-400 text-right">{formatBRL(dia.devolveu)}</span>

                {dia.lojaPagou > 0 && (
                    <>
                        <span className="text-zinc-400">A loja pagou</span>
                        <span className="font-mono text-red-400 text-right">{formatBRL(dia.lojaPagou)}</span>
                    </>
                )}
                {dia.ajustes !== 0 && (
                    <>
                        <span className="text-zinc-400">Ajustes</span>
                        <span className={`font-mono text-right ${dia.ajustes > 0 ? "text-green-400" : "text-red-400"}`}>
                            {dia.ajustes > 0 ? "+" : "−"}{formatBRL(Math.abs(dia.ajustes))}
                        </span>
                    </>
                )}

                <span className="text-zinc-300 font-semibold pt-1 border-t border-zinc-700">Saldo no fim do dia</span>
                <span className={`font-mono font-bold text-right pt-1 border-t border-zinc-700 ${dia.saldoNoFim > 0 ? "text-green-400" : dia.saldoNoFim < 0 ? "text-red-400" : "text-zinc-300"}`}>
                    {dia.saldoNoFim < 0 ? "−" : ""}{formatBRL(Math.abs(dia.saldoNoFim))}
                </span>
            </div>

            {hrefRegistrar && (
                <Link
                    href={hrefRegistrar}
                    className="min-h-11 flex items-center justify-center gap-2 bg-zinc-700 border border-zinc-600 text-white rounded-xl font-bold text-sm hover:bg-zinc-600"
                >
                    <HandCoins size={16} /> Registrar devolução deste dia
                </Link>
            )}
        </div>
    );
}

function CartaoDoPeriodo({ periodo, perspective }: { periodo: PeriodoDoLedger; perspective: "motoboy" | "loja" }) {
    const t = periodo.totais;
    const falta = faltaDevolver(t);
    const sobra = devolveuAMais(t);
    const ele = perspective === "loja" ? "com ele" : "com você";

    return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-white">{comMaiuscula(periodo.rotulo)}</span>
                <span className="text-xs text-zinc-400">
                    {t.corridas} {t.corridas === 1 ? "corrida" : "corridas"} · {periodo.dias.length}{" "}
                    {periodo.dias.length === 1 ? "dia com movimento" : "dias com movimento"}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <span className="text-zinc-400">Ganhou</span>
                <span className="font-mono text-green-400 text-right">{formatBRL(t.ganho)}</span>

                <span className="text-zinc-400">Dinheiro {ele}</span>
                <span className="font-mono text-red-400 text-right">{formatBRL(t.dinheiroComEle)}</span>

                <span className="text-zinc-400">Devolveu</span>
                <span className="font-mono text-green-400 text-right">{formatBRL(t.devolveu)}</span>

                {t.lojaPagou > 0 && (
                    <>
                        <span className="text-zinc-400">A loja pagou</span>
                        <span className="font-mono text-red-400 text-right">{formatBRL(t.lojaPagou)}</span>
                    </>
                )}
                {t.ajustes !== 0 && (
                    <>
                        <span className="text-zinc-400">Ajustes</span>
                        <span className={`font-mono text-right ${t.ajustes > 0 ? "text-green-400" : "text-red-400"}`}>
                            {t.ajustes > 0 ? "+" : "−"}{formatBRL(Math.abs(t.ajustes))}
                        </span>
                    </>
                )}
            </div>

            <p className={`text-sm font-semibold ${sobra > 0 ? "text-green-300" : falta > 0 ? "text-red-300" : "text-zinc-300"}`}>
                {sobra > 0
                    ? `Devolveu ${formatBRL(sobra)} a mais`
                    : falta > 0
                        ? `Falta devolver ${formatBRL(falta)}`
                        : "Dinheiro do cliente todo devolvido"}
            </p>

            <div className="flex items-center justify-between gap-2 text-xs text-zinc-400 pt-1 border-t border-zinc-700">
                <span>Saldo: {formatBRL(periodo.saldoInicial)}</span>
                <span className="text-zinc-500">→</span>
                <span className="font-mono text-white">{formatBRL(periodo.saldoFinal)}</span>
            </div>
        </div>
    );
}

function Devolucoes({
    devolucoes, total, perspective, hrefRegistrar,
}: {
    devolucoes: LinhaDeDevolucao[];
    total: number;
    perspective: "motoboy" | "loja";
    hrefRegistrar?: string;
}) {
    const mostradas = devolucoes.slice(0, MAX_DEVOLUCOES);

    return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-zinc-700">
                <span className="font-bold text-white">Devoluções</span>
                <span className="font-mono text-green-400">{formatBRL(total)}</span>
            </div>

            {mostradas.length === 0 ? (
                <p className="p-6 text-center text-zinc-400 text-sm">
                    {perspective === "loja"
                        ? "Nenhuma devolução registrada neste período."
                        : "Você não registrou devolução neste período."}
                </p>
            ) : (
                <div className="divide-y divide-zinc-700">
                    {mostradas.map((d) => (
                        <div key={d.id} className="p-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">
                                    {d.description || "Motoboy me entregou dinheiro"}
                                </div>
                                <div className="text-xs text-zinc-500">
                                    {fmtShortDateTime(d.createdAt)}{d.creatorName ? ` · por ${d.creatorName}` : ""}
                                </div>
                            </div>
                            <div className="font-mono font-bold text-green-400 shrink-0">+{formatBRL(d.amount)}</div>
                        </div>
                    ))}
                </div>
            )}

            {devolucoes.length > mostradas.length && (
                <p className="px-4 py-2 text-xs text-zinc-400 border-t border-zinc-700">
                    Mostrando as {mostradas.length} mais recentes de {devolucoes.length}.
                </p>
            )}

            {hrefRegistrar && (
                <div className="p-3 border-t border-zinc-700">
                    <Link
                        href={hrefRegistrar}
                        className="min-h-11 flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-500 active:scale-[0.98]"
                    >
                        <Plus size={18} /> Registrar devolução
                    </Link>
                </div>
            )}
        </div>
    );
}
