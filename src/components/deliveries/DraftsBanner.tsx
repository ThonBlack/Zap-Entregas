import Link from "next/link";
import { ChevronRight, PackageSearch } from "lucide-react";

interface DraftsBannerProps {
    drafts: { id: number; address: string; customerName: string | null; createdAt: string | null }[];
}

/**
 * Faixa no topo do painel: corridas que vieram do PDV e ainda não foram liberadas.
 * Enquanto estiverem aqui, nenhum motoboy as enxerga.
 */
export default function DraftsBanner({ drafts }: DraftsBannerProps) {
    if (!drafts.length) return null;

    return (
        <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <PackageSearch size={18} className="text-yellow-400" />
                <h2 className="font-semibold text-yellow-200">
                    {drafts.length === 1
                        ? "1 corrida esperando sua confirmação"
                        : `${drafts.length} corridas esperando sua confirmação`}
                </h2>
            </div>
            <p className="px-4 pb-3 text-xs text-yellow-200/70">
                Vieram do PDV. O motoboy só vê depois que você conferir o endereço e liberar.
            </p>
            <ul className="divide-y divide-yellow-500/20">
                {drafts.map((d) => (
                    <li key={d.id}>
                        <Link
                            href={`/deliveries/${d.id}/confirmar`}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-yellow-500/10 transition-colors"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-white truncate">{d.address}</p>
                                <p className="text-xs text-zinc-400 truncate">
                                    {d.customerName || "Sem nome"}
                                    {d.createdAt && ` · ${new Date(d.createdAt + "Z").toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`}
                                </p>
                            </div>
                            <span className="text-xs font-medium text-yellow-300 whitespace-nowrap">Conferir</span>
                            <ChevronRight size={16} className="text-yellow-400 flex-shrink-0" />
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
