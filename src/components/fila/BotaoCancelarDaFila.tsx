"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import ConfirmationModal from "@/components/shared/ConfirmationModal";
import { cancelarCorridaDaFilaAction } from "@/app/actions/queue";

/**
 * O botão "Cancelar" de cada linha da fila.
 *
 * Sempre com confirmação: cancelar é o único botão desta tela que desfaz
 * trabalho, e o vendedor está atendendo cliente enquanto clica.
 */
export default function BotaoCancelarDaFila({
    deliveryId,
    queueToken,
    rotulo,
    temMotoboy,
}: {
    deliveryId: number;
    queueToken: string;
    /** Como a corrida é chamada na tela ("Corrida 7" ou "#135"). */
    rotulo: string;
    /** Já tem motoboy no nome dela? Muda o aviso do modal. */
    temMotoboy: boolean;
}) {
    const router = useRouter();
    const [aberto, setAberto] = useState(false);
    const [erro, setErro] = useState("");
    const [executando, startTransition] = useTransition();

    const cancelar = () => {
        setAberto(false);
        setErro("");
        const fd = new FormData();
        fd.set("id", String(deliveryId));
        fd.set("queueToken", queueToken);
        startTransition(async () => {
            const res = await cancelarCorridaDaFilaAction(fd);
            if (res && "error" in res) { setErro(res.error); return; }
            router.refresh();
        });
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setAberto(true)}
                disabled={executando}
                className="flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl border border-red-500/40 bg-zinc-900 text-red-300 font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
                {executando ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Cancelar
            </button>

            {erro && <p className="text-xs text-red-300 mt-1">{erro}</p>}

            <ConfirmationModal
                isOpen={aberto}
                onClose={() => setAberto(false)}
                onConfirm={cancelar}
                title={`Cancelar a ${rotulo}?`}
                description={
                    temMotoboy
                        ? "O motoboy que está com ela vai ser avisado na hora. A venda no sistema da loja não é afetada."
                        : "A corrida some da lista e nenhum motoboy vai vê-la. A venda no sistema da loja não é afetada."
                }
                confirmText="Cancelar corrida"
                cancelText="Voltar"
                variant="danger"
            />
        </>
    );
}
