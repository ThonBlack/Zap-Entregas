import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, XCircle } from "lucide-react";
import { KIND_LABEL, formatBRL, type Statement } from "@/lib/wallet";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Props = {
    statement: Statement;
    /** rota base da página, pra montar a navegação de mês (?m=&y=) */
    basePath: string;
    /** "motoboy" = fala "você"; "loja" = fala "ele" */
    perspective: "motoboy" | "loja";
};

function fmtDate(iso: string) {
    const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function BalanceHeadline({ balance, perspective }: { balance: number; perspective: "motoboy" | "loja" }) {
    const abs = formatBRL(Math.abs(balance));
    if (balance > 0) {
        return { label: perspective === "motoboy" ? "A receber da loja" : "Você deve ao motoboy", value: abs, tone: "green" as const };
    }
    if (balance < 0) {
        return { label: perspective === "motoboy" ? "Você deve à loja" : "Motoboy deve a você", value: abs, tone: "red" as const };
    }
    return { label: "Saldo zerado", value: abs, tone: "zinc" as const };
}

export default function StatementView({ statement, basePath, perspective }: Props) {
    const { month, year, lines, totals, openingBalance, balance } = statement;
    const prev = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };
    const next = month === 12 ? { m: 1, y: year + 1 } : { m: month + 1, y: year };
    const head = BalanceHeadline({ balance, perspective });

    const toneBg = { green: "bg-green-700 border-green-600", red: "bg-red-800 border-red-700", zinc: "bg-zinc-700 border-zinc-600" }[head.tone];

    return (
        <div className="space-y-4">
            {/* Saldo geral */}
            <div className={`rounded-2xl border p-5 text-white ${toneBg}`}>
                <p className="text-xs uppercase tracking-wide opacity-80">{head.label}</p>
                <p className="text-3xl font-bold mt-1">{head.value}</p>
            </div>

            {/* Navegação de mês */}
            <div className="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2">
                <Link href={`${basePath}?m=${prev.m}&y=${prev.y}`} className="p-2 text-zinc-300 hover:text-white" aria-label="Mês anterior">
                    <ChevronLeft size={20} />
                </Link>
                <span className="font-bold text-white capitalize">{MESES[month - 1]} / {year}</span>
                <Link href={`${basePath}?m=${next.m}&y=${next.y}`} className="p-2 text-zinc-300 hover:text-white" aria-label="Próximo mês">
                    <ChevronRight size={20} />
                </Link>
            </div>

            {/* Resumo do mês */}
            <div className="grid grid-cols-2 gap-2 text-sm">
                <Resumo label="Corridas" value={totals.corridas} tone="green" />
                <Resumo label="Dinheiro retido" value={-totals.dinheiro} tone="red" />
                <Resumo label="Pagamentos" value={totals.pagamentos} />
                <Resumo label="Ajustes" value={totals.ajustes} />
            </div>

            <div className="text-xs text-zinc-400 flex justify-between px-1">
                <span>Saldo no início do mês</span>
                <span className="font-mono">{formatBRL(openingBalance)}</span>
            </div>

            {/* Linhas */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl divide-y divide-zinc-700">
                {lines.length === 0 ? (
                    <p className="p-6 text-center text-zinc-400 text-sm">Nenhum lançamento neste mês.</p>
                ) : lines.map(l => {
                    const isCredit = l.type === "credit";
                    const confirmed = l.status === "confirmed";
                    return (
                        <div key={l.id} className={`p-3 flex items-center gap-3 ${confirmed ? "" : "opacity-60"}`}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
                                        {KIND_LABEL[l.kind]}
                                    </span>
                                    {l.status === "pending" && (
                                        <span className="text-[10px] flex items-center gap-1 text-yellow-400"><Clock size={10} /> aguardando</span>
                                    )}
                                    {l.status === "rejected" && (
                                        <span className="text-[10px] flex items-center gap-1 text-red-400"><XCircle size={10} /> recusado</span>
                                    )}
                                </div>
                                <div className="text-sm text-white truncate mt-0.5">{l.description || KIND_LABEL[l.kind]}</div>
                                <div className="text-xs text-zinc-500">
                                    {fmtDate(l.createdAt)}
                                    {l.creatorName && l.kind !== "corrida" && l.kind !== "dinheiro" ? ` · por ${l.creatorName}` : ""}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className={`font-mono font-bold ${isCredit ? "text-green-400" : "text-red-400"}`}>
                                    {isCredit ? "+" : "−"}{formatBRL(l.amount)}
                                </div>
                                {confirmed && (
                                    <div className="text-[11px] font-mono text-zinc-500">= {formatBRL(l.runningBalance)}</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Resumo({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" }) {
    const color = tone === "green" ? "text-green-400" : tone === "red" ? "text-red-400" : value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-zinc-300";
    return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3">
            <div className="text-xs text-zinc-400">{label}</div>
            <div className={`font-mono font-bold ${color}`}>{value < 0 ? "−" : ""}{formatBRL(Math.abs(value))}</div>
        </div>
    );
}
