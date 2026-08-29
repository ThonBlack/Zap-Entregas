"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

import ConfirmationModal from "@/components/shared/ConfirmationModal";
import { deleteMotoboyAction } from "@/app/actions/motoboy";

/**
 * Excluir motoboy é irreversível o bastante pra pedir a palavra "EXCLUIR" — o
 * botão ficava do lado do "editar" e um toque errado no celular tirava a pessoa
 * da equipe sem perguntar nada.
 *
 * Quem já rodou corrida não é apagado, é desativado (o extrato e a dívida dele
 * continuam); por isso o texto do aviso muda conforme o caso.
 */
export default function DeleteMotoboyButton({
    id,
    nome,
    temHistorico,
}: {
    id: number;
    nome: string;
    temHistorico: boolean;
}) {
    const [aberto, setAberto] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [pendente, startTransition] = useTransition();
    const router = useRouter();

    function confirmar() {
        setErro(null);
        startTransition(async () => {
            const fd = new FormData();
            fd.set("id", String(id));
            const r = await deleteMotoboyAction(fd);
            if (r && "error" in r && r.error) {
                setErro(r.error);
                return;
            }
            router.refresh();
        });
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setAberto(true)}
                disabled={pendente}
                className="p-2 text-zinc-400 hover:text-red-400 transition-colors bg-zinc-700 rounded-lg hover:bg-red-900/30 disabled:opacity-50"
                title={temHistorico ? "Desativar motoboy" : "Excluir motoboy"}
            >
                {pendente ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
            </button>

            {erro && (
                <span role="alert" className="text-xs text-red-400 max-w-[10rem]">
                    {erro}
                </span>
            )}

            <ConfirmationModal
                isOpen={aberto}
                onClose={() => setAberto(false)}
                onConfirm={confirmar}
                variant="danger"
                title={temHistorico ? `Desativar ${nome}?` : `Excluir ${nome}?`}
                description={
                    temHistorico
                        ? `${nome} já tem corridas ou lançamentos, então a conta não é apagada: ela é desativada. Ele sai da lista e não entra mais no app, mas o extrato e a dívida dele continuam guardados.`
                        : `${nome} nunca rodou nenhuma corrida, então a conta será apagada de vez. Não dá pra desfazer.`
                }
                confirmText={temHistorico ? "Desativar" : "Excluir"}
                requireConfirmationWord="EXCLUIR"
            />
        </>
    );
}
