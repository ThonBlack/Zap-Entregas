import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";

import { hojeBrasiliaISO } from "@/lib/datetime";

/**
 * Botão em destaque no alto do painel do lojista: leva direto pro "Resumo do
 * dia" já no dia de hoje.
 *
 * O resumo mora em /motoboys/[id]/fechamento e precisa saber de qual motoboy é
 * o dia. Quem resolve isso é /relatorio-do-dia: com um motoboy só ele pula
 * direto pro resumo; com vários, mostra a lista. Aqui é só o atalho.
 */
export default function BotaoRelatorioDoDia() {
    // Mesmo "hoje" do fechamento (fuso de Brasília), não o do relógio do servidor.
    const hoje = hojeBrasiliaISO();

    return (
        <Link
            href={`/relatorio-do-dia?d=${hoje}`}
            className="flex items-center gap-3 w-full min-h-14 px-4 py-3 rounded-2xl border border-green-600/60 bg-green-600/15 hover:bg-green-600/25 active:bg-green-600/30 transition-colors shadow-sm"
        >
            <span className="w-10 h-10 rounded-xl bg-green-600/25 flex items-center justify-center text-green-300 shrink-0">
                <ClipboardCheck size={22} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-white leading-tight">Relatório do dia</span>
                <span className="block text-xs text-green-200/80 leading-tight mt-0.5">
                    Corridas, dinheiro e acerto de hoje
                </span>
            </span>
            <ChevronRight size={20} className="text-green-400 shrink-0" />
        </Link>
    );
}
