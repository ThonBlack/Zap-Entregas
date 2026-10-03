import "server-only";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { deliveries, users } from "@/db/schema";
import { planejarDestino } from "@/lib/deliveryAssign";
import { motoboyServeALoja } from "@/lib/lojaDaCorrida";
import { pushDeCorridaDestinada, pushDeCorridaNova, pushToUser } from "@/lib/push";
import { avisoDeCorridaNovaComNumero, resumoDoLocal } from "@/lib/deliveryPrivacy";
import { rotuloCorrida } from "@/lib/dailySeq-shared";
import { logServerEvent } from "@/lib/serverLog";

/**
 * Tirar a corrida de um motoboy e passar pra outro (ou devolver pra fila).
 *
 * Três portas chegam aqui, e todas têm que obedecer a MESMA régua — por isso
 * o miolo é um só:
 *   - a loja logada no app (assignDeliveryAction);
 *   - o admin (a mesma action, com a janela maior: até depois da coleta);
 *   - o vendedor na Fila da loja, autorizado só pelo código da sessão.
 *
 * O que acontece aqui, em ordem:
 *   1. o motoboy novo é conferido: existe, está ativo e é da equipe da loja DA
 *      CORRIDA (nunca da loja de quem clicou — o admin não tem loja);
 *   2. a decisão (janela, status, carimbo) sai de planejarDestino;
 *   3. o UPDATE repete no WHERE o status E o dono que foram lidos: se o motoboy
 *      coletou, aceitou ou outro clique trocou no meio do caminho, nada é
 *      gravado e a tela pede pra atualizar;
 *   4. avisos: o antigo fica sabendo que a corrida saiu dele, o novo recebe o
 *      aviso normal de corrida destinada; devolvida pra fila vira anúncio;
 *   5. rastro em app_logs: quem trocou, de quem pra quem, quando.
 *
 * Dinheiro: NADA. O crédito da taxa e o débito do dinheiro só nascem quando a
 * corrida é marcada como entregue (src/lib/deliveryLedger.ts) e vão pro
 * motoboy que estiver na corrida NAQUELE momento. Trocar antes da entrega não
 * gera, não move e não estorna lançamento nenhum.
 */

export type QuemTroca =
    | { papel: "admin"; id: number; nome: string }
    | { papel: "loja"; id: number; nome: string }
    | { papel: "fila"; shopkeeperId: number; operador: string | null };

export type CorridaParaTrocar = Pick<
    typeof deliveries.$inferSelect,
    "id" | "status" | "motoboyId" | "shopkeeperId" | "observation" | "pickedUpAt" | "address" | "dailySeq"
>;

export type ResultadoDaTroca = { ok: false; erro: string } | { ok: true; jaEra: boolean };

/** A loja em nome de quem a troca é feita (fila e lojista). Admin: nenhuma. */
function lojaDeQuem(quem: QuemTroca): number | null {
    if (quem.papel === "loja") return quem.id;
    if (quem.papel === "fila") return quem.shopkeeperId;
    return null;
}

/**
 * O motoboy escolhido serve pra ESTA corrida?
 *
 * Loja e fila: só a equipe estrita da loja (users.shopkeeper_id = loja) — a
 * mesma lista que o lojista vê no app (motoboyScope). Admin: a régua de
 * `motoboyServeALoja`, que inclui os "da casa" (sem loja). Antes o admin
 * conseguia destinar a corrida da loja A pro motoboy da loja B.
 *
 * Fora da equipe responde igual a "não existe", pra não confirmar que o id
 * existe em outra loja.
 *
 * Exportada porque a liberação do rascunho (src/lib/liberarRascunho.ts) usa a
 * mesma régua quando a loja já escolhe o motoboy na conferência.
 */
export async function conferirMotoboyDaCorrida(
    quem: QuemTroca,
    corrida: { shopkeeperId: number | null },
    motoboyId: number,
): Promise<{ ok: true; motoboy: { id: number; name: string } } | { ok: false; erro: string }> {
    const naoEDaEquipe = quem.papel === "admin"
        ? "Esse motoboy não é da equipe dessa loja."
        : "Esse motoboy não é da sua equipe.";
    if (!Number.isInteger(motoboyId) || motoboyId <= 0) return { ok: false, erro: naoEDaEquipe };

    const m = await db.query.users.findFirst({
        where: and(eq(users.id, motoboyId), eq(users.role, "motoboy")),
        columns: { id: true, name: true, isActive: true, shopkeeperId: true },
    });
    if (!m) return { ok: false, erro: naoEDaEquipe };

    const loja = lojaDeQuem(quem);
    const serve = loja != null
        ? m.shopkeeperId === loja
        : corrida.shopkeeperId != null
            ? motoboyServeALoja(m, corrida.shopkeeperId)
            // Corrida antiga sem loja: só motoboy "da casa".
            : m.shopkeeperId == null;
    if (!serve) return { ok: false, erro: naoEDaEquipe };
    if (m.isActive === false) return { ok: false, erro: "Esse motoboy está desativado." };

    return { ok: true, motoboy: { id: m.id, name: m.name } };
}

function autoriaDe(quem: QuemTroca): string {
    if (quem.papel === "admin") return "pelo admin";
    if (quem.papel === "fila" && quem.operador?.trim()) return `pela loja (${quem.operador.trim()})`;
    return "pela loja";
}

export async function trocarMotoboyDaCorrida(
    corrida: CorridaParaTrocar,
    novoMotoboyId: number | null,
    quem: QuemTroca,
): Promise<ResultadoDaTroca> {
    let escolhido: { id: number; name: string } | null = null;
    if (novoMotoboyId != null) {
        const conferido = await conferirMotoboyDaCorrida(quem, corrida, Number(novoMotoboyId));
        if (!conferido.ok) return conferido;
        escolhido = conferido.motoboy;
    }

    const agora = new Date().toISOString();
    const plano = planejarDestino(
        {
            status: corrida.status,
            motoboyId: corrida.motoboyId,
            observation: corrida.observation,
            pickedUpAt: corrida.pickedUpAt,
        },
        escolhido,
        agora,
        { permitirColetada: quem.papel === "admin", autoria: autoriaDe(quem) },
    );
    if (!plano.ok) return { ok: false, erro: plano.erro };
    if (plano.jaEra) return { ok: true, jaEra: true };

    const loja = lojaDeQuem(quem);
    const mudou = await db.update(deliveries)
        .set({
            motoboyId: plano.motoboyId,
            status: plano.status,
            acceptedAt: plano.acceptedAt,
            observation: plano.observation,
            ...(plano.pickedUpAt === null ? { pickedUpAt: null } : {}),
            updatedAt: agora,
        })
        .where(and(
            eq(deliveries.id, corrida.id),
            eq(deliveries.status, corrida.status),
            corrida.motoboyId == null
                ? isNull(deliveries.motoboyId)
                : eq(deliveries.motoboyId, corrida.motoboyId),
            loja != null ? eq(deliveries.shopkeeperId, loja) : undefined,
        ))
        .returning({ id: deliveries.id });

    if (!mudou.length) return { ok: false, erro: "Essa corrida mudou de situação. Atualize a tela." };

    avisarTroca(corrida, escolhido).catch(() => { });

    const de = corrida.motoboyId ?? null;
    await logServerEvent(
        "motoboy_trocado",
        `Corrida ${corrida.id}: ${de ?? "fila"} → ${escolhido?.id ?? "fila"} (${quem.papel})`,
        {
            page: quem.papel === "fila" ? "/fila" : "/app",
            userId: quem.papel === "fila" ? quem.shopkeeperId : quem.id,
            deliveryId: corrida.id,
            de,
            para: escolhido?.id ?? null,
            statusAntes: corrida.status,
            statusDepois: plano.status,
            por: quem.papel,
            ...(quem.papel === "fila" ? { operatorName: quem.operador } : { quem: quem.nome }),
        },
    );

    return { ok: true, jaEra: false };
}

/**
 * Os pushes da troca. Fora do caminho principal: aviso que não chega não pode
 * desfazer uma troca que já está gravada.
 */
async function avisarTroca(
    corrida: CorridaParaTrocar,
    escolhido: { id: number; name: string } | null,
): Promise<void> {
    const rotulo = rotuloCorrida(corrida.dailySeq) ?? `Corrida #${corrida.id}`;
    const antigo = corrida.motoboyId ?? null;

    // Quem perdeu a corrida precisa saber JÁ: pode estar indo buscar o pedido
    // ou, se já coletou, com ele na mochila.
    if (antigo != null && antigo !== escolhido?.id) {
        await pushToUser(antigo, {
            title: escolhido ? "🔁 Corrida passada pra outro motoboy" : "↩️ Corrida devolvida pra fila",
            body: corrida.status === "picked_up"
                ? `${rotulo} saiu da sua lista. Combine com a loja o que fazer com o pedido.`
                : `${rotulo} saiu da sua lista. Não precisa mais buscar.`,
            url: "/app",
            tag: `entrega-${corrida.id}`,
        });
    }

    if (escolhido) {
        const loja = corrida.shopkeeperId != null
            ? await db.query.users.findFirst({
                where: eq(users.id, corrida.shopkeeperId),
                columns: { name: true },
            })
            : null;
        // Mesmo aviso de sempre da corrida destinada: só o bairro, nada de
        // endereço com número nem telefone do cliente.
        await pushDeCorridaDestinada(
            escolhido.id, corrida.id, resumoDoLocal(corrida.address), loja?.name ?? null, corrida.dailySeq,
        );
    } else {
        // Voltou pra fila aberta: quem pode ver a corrida fica sabendo que ela
        // está livre (mesma régua do anúncio de corrida nova, src/lib/team.ts).
        await pushDeCorridaNova(corrida.shopkeeperId, {
            title: "🏍️ Nova Corrida Disponível!",
            body: avisoDeCorridaNovaComNumero(corrida.dailySeq, corrida.address),
            url: "/app",
            tag: "nova-corrida",
        });
    }
}
