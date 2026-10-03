"use server";

import { revalidatePath } from "next/cache";
import { autorizarFila, corridaDaLoja } from "@/lib/filaPorteiro";
import { trocarMotoboyDaCorrida } from "@/lib/trocaDeMotoboy";
import { podeTrocarMotoboyNaFila } from "@/lib/fila-shared";
import { logServerError } from "@/lib/serverLog";

/**
 * Trocar o motoboy (ou devolver pra fila aberta) pela "Fila da loja".
 *
 * Mora fora de src/app/actions/queue.ts só pra aquele arquivo não passar do
 * tamanho; a porta é a mesma (src/lib/filaPorteiro.ts) e o miolo também é o
 * mesmo da loja e do admin (src/lib/trocaDeMotoboy.ts).
 *
 * O que o vendedor pode e não pode:
 *   - só corrida DESTA loja (a sessão decide, nunca o navegador);
 *   - só motoboy da equipe DESTA loja (conferido no servidor);
 *   - só até a coleta — depois o pedido está na rua e quem decide é o admin.
 *
 * O `motoboyId` vazio significa "Qualquer um (fila aberta)".
 */

type ResultadoDaFila = { error: string } | { success: true };

export async function trocarMotoboyDaFilaAction(formData: FormData): Promise<ResultadoDaFila> {
    try {
        const porta = await autorizarFila(formData.get("queueToken"));
        if (!porta.ok) return { error: porta.erro };
        const { sessao } = porta;

        const corrida = await corridaDaLoja(sessao, formData.get("id"));
        if (!corrida) return { error: "Corrida não encontrada." };
        if (!podeTrocarMotoboyNaFila(corrida)) {
            return { error: "O motoboy já saiu com esse pedido — não dá mais pra trocar." };
        }

        const bruto = String(formData.get("motoboyId") ?? "").trim();
        const novo = bruto ? Number(bruto) : null;
        if (novo !== null && (!Number.isInteger(novo) || novo <= 0)) {
            return { error: "Esse motoboy não é da sua equipe." };
        }

        const troca = await trocarMotoboyDaCorrida(corrida, novo, {
            papel: "fila",
            shopkeeperId: sessao.shopkeeperId,
            operador: sessao.operatorName,
        });
        if (!troca.ok) return { error: troca.erro };

        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[FILA] trocar motoboy falhou:", e);
        await logServerError("fila_trocar_motoboy", e, { page: "/fila" });
        return { error: "Não consegui trocar o motoboy agora. Tente de novo." };
    }
}
