import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";

import { db } from "@/db";
import { users } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getMotoboysComCorridasNoDia } from "@/lib/dailySummary";
import { getClosingsForDay } from "@/lib/dailyClosing";
import { hojeBrasiliaISO } from "@/lib/datetime";
import { CLOSING_STATUS_LABEL } from "@/lib/dailyClosing-shared";

/**
 * Atalho "Fechar o dia" no painel do lojista: quem rodou hoje e em que pé está
 * o acerto de cada um. Some quando ninguém entregou nada.
 */
export default async function FecharODiaCard({ shopkeeperId }: { shopkeeperId: number | null }) {
    const hoje = hojeBrasiliaISO();
    const comCorridas = await getMotoboysComCorridasNoDia(shopkeeperId, hoje);
    if (!comCorridas.length) return null;

    const ids = comCorridas.map((m) => m.motoboyId);
    const [nomes, fechamentos] = await Promise.all([
        db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)),
        getClosingsForDay(ids, hoje),
    ]);
    const nomePor = new Map(nomes.map((n) => [n.id, n.name]));

    return (
        <div className="rounded-2xl border border-green-700/50 bg-green-600/10 overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-1">
                <ClipboardCheck size={18} className="text-green-400" />
                <h2 className="font-semibold text-green-200">Fechar o dia</h2>
            </div>
            <p className="px-4 pb-3 text-xs text-green-200/70">
                Confira as corridas de hoje e mande o motoboy confirmar o acerto.
            </p>
            <ul className="divide-y divide-green-700/20">
                {comCorridas.map((m) => {
                    const fechamento = fechamentos.get(m.motoboyId);
                    return (
                        <li key={m.motoboyId}>
                            <Link
                                href={`/motoboys/${m.motoboyId}/fechamento?d=${hoje}`}
                                className="flex items-center gap-3 px-4 py-3 min-h-11 hover:bg-green-600/10 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-white truncate">{nomePor.get(m.motoboyId) ?? `Motoboy #${m.motoboyId}`}</p>
                                    <p className="text-xs text-zinc-400">
                                        {m.corridas} {m.corridas === 1 ? "corrida hoje" : "corridas hoje"}
                                        {fechamento && fechamento.status !== "draft"
                                            ? ` · ${CLOSING_STATUS_LABEL[fechamento.status]}`
                                            : ""}
                                    </p>
                                </div>
                                <span className="text-xs font-medium text-green-300 whitespace-nowrap">
                                    {fechamento && fechamento.status !== "draft" ? "Ver" : "Conferir"}
                                </span>
                                <ChevronRight size={16} className="text-green-400 shrink-0" />
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
