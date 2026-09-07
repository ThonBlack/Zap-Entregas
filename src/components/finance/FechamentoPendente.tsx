import { AlertTriangle, ClipboardCheck } from "lucide-react";

import { getPendingClosingsForMotoboy } from "@/lib/dailyClosing";
import { getDailySummary } from "@/lib/dailySummary";
import { formatBRL } from "@/lib/wallet-shared";
import { fmtDiaLegivel, fmtTime } from "@/lib/datetime";
import { fechamentoDivergente, textoLiquido, tomLiquido } from "@/lib/dailyClosing-shared";
import FechamentoRespostaBotoes from "./FechamentoRespostaBotoes";

/**
 * Card "Fechamento de <dia>" no painel e no extrato do motoboy.
 *
 * Aparece só quando a loja mandou um resumo pra ele conferir. Os números são os
 * que a loja CONGELOU no envio — é isso que ele está confirmando. A lista de
 * corridas embaixo é só pra ele lembrar do dia.
 */
export default async function FechamentoPendente({ motoboyId }: { motoboyId: number }) {
    const pendentes = await getPendingClosingsForMotoboy(motoboyId);
    if (!pendentes.length) return null;

    const resumos = await Promise.all(
        pendentes.map((c) => getDailySummary(motoboyId, c.shopkeeperId, c.day)),
    );

    return (
        <div className="space-y-4">
            {pendentes.map((c, i) => {
                const tom = tomLiquido(c.net);
                const cor = {
                    green: "border-green-600/60 bg-green-600/10",
                    red: "border-red-600/60 bg-red-600/10",
                    zinc: "border-zinc-600 bg-zinc-800",
                }[tom];
                const corrida = c.deliveriesCount === 1 ? "corrida" : "corridas";
                const vivo = resumos[i];
                const linhas = vivo.lines;
                const { divergente } = fechamentoDivergente(
                    {
                        deliveriesCount: c.deliveriesCount,
                        feesTotal: c.feesTotal,
                        cashTotal: c.cashTotal,
                        pixTotal: c.pixTotal,
                        cardTotal: c.cardTotal,
                        net: c.net,
                    },
                    {
                        deliveriesCount: vivo.deliveriesCount,
                        feesTotal: vivo.feesTotal,
                        cashTotal: vivo.cashTotal,
                        pixTotal: vivo.pixTotal,
                        cardTotal: vivo.cardTotal,
                        net: vivo.net,
                    },
                );

                return (
                    <div key={c.id} className={`rounded-2xl border p-4 space-y-3 ${cor}`}>
                        <div className="flex items-center gap-2 text-white">
                            <ClipboardCheck size={20} className="text-green-400" />
                            <h2 className="font-bold">Fechamento de {fmtDiaLegivel(c.day)}</h2>
                        </div>

                        <p className="text-sm text-zinc-200 leading-relaxed">
                            Você fez <strong>{c.deliveriesCount} {corrida}</strong> — {formatBRL(c.feesTotal)} de taxa.
                            {c.cashTotal > 0 && <> Recebeu <strong>{formatBRL(c.cashTotal)}</strong> em dinheiro.</>}
                            {c.pixTotal > 0 && <> {formatBRL(c.pixTotal)} caíram em PIX na loja.</>}
                            {c.cardTotal > 0 && <> {formatBRL(c.cardTotal)} foram no cartão.</>}
                        </p>

                        <p className="text-lg font-bold text-white">{textoLiquido(c.net, "motoboy")}</p>

                        {c.note && (
                            <p className="text-sm text-zinc-300 bg-zinc-900/50 rounded-lg p-3">
                                Recado da loja: “{c.note}”
                            </p>
                        )}

                        {divergente && (
                            <p className="text-xs text-yellow-300/90 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5 flex items-start gap-1.5">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                A loja alterou alguma corrida depois de enviar este resumo. Se os números não
                                batem, toque em “Está errado”.
                            </p>
                        )}

                        {linhas.length > 0 && (
                            <details className="bg-zinc-900/50 rounded-lg">
                                <summary className="cursor-pointer px-3 py-2 text-sm text-zinc-300">
                                    Ver as {linhas.length} {linhas.length === 1 ? "corrida" : "corridas"} do dia
                                </summary>
                                <ul className="divide-y divide-zinc-700/60">
                                    {linhas.map((l) => (
                                        <li key={l.id} className="px-3 py-2 flex items-center gap-3 text-xs">
                                            <span className="text-zinc-500 shrink-0">{fmtTime(l.deliveredAt)}</span>
                                            <span className="flex-1 min-w-0 truncate text-zinc-300">
                                                {l.customerName || "Cliente"} · {l.address.split(",")[0]}
                                            </span>
                                            <span className="font-mono text-green-400 shrink-0">{formatBRL(l.fee)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}

                        <FechamentoRespostaBotoes closingId={c.id} />
                    </div>
                );
            })}
        </div>
    );
}
