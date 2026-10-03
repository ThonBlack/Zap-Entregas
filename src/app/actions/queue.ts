"use server";

import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { autorizarFila, corridaDaLoja } from "@/lib/filaPorteiro";
import { conferirMotoboyDaCorrida } from "@/lib/trocaDeMotoboy";
import { liberarRascunho } from "@/lib/liberarRascunho";
import { criarCorridaDaLoja } from "@/lib/novaCorrida";
import { resolverPontoEditado } from "@/lib/deliveryEdit";
import { parseMoney } from "@/lib/money";
import { normalizarChargeMode, type ChargeMode } from "@/lib/chargeMode";
import { pushDeCorridaNova, pushToUser } from "@/lib/push";
import { avisoDeCorridaNovaComNumero } from "@/lib/deliveryPrivacy";
import { logServerError, logServerEvent } from "@/lib/serverLog";
import { carimboDaFila, podeCancelarNaFila, podeEditarNaFila } from "@/lib/fila-shared";

/**
 * As ações da "Fila da loja" — a tela que o VENDEDOR abre dentro do painel do
 * EpicStore, sem ter conta no Zap Entregas.
 *
 * A regra que vale pra TODAS, sem exceção:
 *
 *   1. o código da sessão chega no formulário e é revalidado no banco (existe?
 *      venceu?) ANTES de qualquer coisa;
 *   2. a corrida é carregada com `shopkeeper_id = o da sessão` no WHERE — não é
 *      carregar e depois comparar, é não achar corrida de outra loja de jeito
 *      nenhum;
 *   3. o UPDATE repete a condição de status no WHERE (`where status in (...)`),
 *      igual a drafts.ts: entre ler e gravar o motoboy pode ter aceitado, e
 *      nesse caso nada pode ser escrito.
 *
 * A tela some com os botões que não cabem, mas a tela é só a primeira barreira:
 * quem manda é o que está aqui.
 *
 * Nada de dinheiro da operação passa por aqui — sem taxa, sem carteira, sem
 * fechamento. O vendedor mexe no pedido, não no acerto com o motoboy.
 */

type ResultadoDaFila = { error: string } | { success: true };

const PAGINA = "/fila";

/** Dinheiro digitado na tela: vazio é zero, ilegível é `null` (vira erro). */
function lerDinheiro(raw: FormDataEntryValue | null): number | null {
    const texto = String(raw ?? "").trim();
    if (!texto) return 0;
    const n = parseMoney(texto);
    return n === null || n < 0 ? null : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conferir o rascunho do PDV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Libera pros motoboys um rascunho que veio da venda — na fila aberta ou já no
 * nome de um motoboy da equipe da loja.
 *
 * Não reescreve a conferência: depois de provar que o rascunho é DESTA loja,
 * entrega o trabalho pro mesmo miolo da conferência de sempre
 * (src/lib/liberarRascunho.ts). Assim a regra do pino, do "Corrida N", do push
 * e da condição de corrida existe num lugar só.
 *
 * O motoboy escolhido é conferido contra a equipe da loja DA SESSÃO
 * (conferirMotoboyDaCorrida): número de motoboy de outra loja vindo do
 * navegador é recusado como se não existisse.
 */
export async function conferirRascunhoDaFilaAction(formData: FormData): Promise<ResultadoDaFila> {
    try {
        const porta = await autorizarFila(formData.get("queueToken"));
        if (!porta.ok) return { error: porta.erro };
        const { sessao } = porta;

        const corrida = await corridaDaLoja(sessao, formData.get("id"));
        if (!corrida) return { error: "Corrida não encontrada." };
        if (corrida.status !== "draft") return { error: "Essa corrida já foi liberada." };

        // Vazio = "Qualquer um (fila aberta)", o comportamento de sempre.
        const quem = { papel: "fila" as const, shopkeeperId: sessao.shopkeeperId, operador: sessao.operatorName };
        let destinatario: { id: number; name: string } | null = null;
        const motoboyIdBruto = String(formData.get("motoboyId") ?? "").trim();
        if (motoboyIdBruto) {
            const conferido = await conferirMotoboyDaCorrida(quem, corrida, Number(motoboyIdBruto));
            if (!conferido.ok) return { error: conferido.erro };
            destinatario = conferido.motoboy;
        }

        // A taxa do motoboy vem do BANCO, nunca do formulário: o campo viaja
        // escondido na tela e quem abrisse o inspetor do navegador poderia
        // trocar o valor. Vendedor não mexe em dinheiro da operação.
        formData.set("fee", String(corrida.fee ?? 0).replace(".", ","));
        const resultado = await liberarRascunho(corrida, formData, {
            destinatario,
            autoria: sessao.operatorName ? `pela loja (${sessao.operatorName})` : "pela loja",
        });
        if ("error" in resultado) return resultado;

        await logServerEvent("fila_conferida", `Corrida ${corrida.id} liberada pela fila da loja`, {
            page: PAGINA,
            userId: sessao.shopkeeperId,
            deliveryId: corrida.id,
            motoboyId: destinatario?.id ?? null,
            operatorName: sessao.operatorName,
        });

        // Revalidar o painel do lojista: ele está com /app aberto no celular e a
        // corrida acabou de sair do bloco de rascunhos.
        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[FILA] conferir falhou:", e);
        await logServerError("fila_conferir", e, { page: PAGINA });
        return { error: "Não consegui liberar a corrida agora. Tente de novo." };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Corrigir uma corrida já liberada
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Corrige endereço, cliente, valor e observação de uma corrida que ainda está
 * na loja.
 *
 * Janela: `pending`, ou `assigned` com o motoboy ainda a caminho de buscar
 * (regra em src/lib/fila-shared.ts, a mesma que a tela usa). Depois da coleta o
 * pedido está na rua — mudar o endereço por baixo mandaria o motoboy pra um
 * lugar diferente do que ele combinou.
 *
 * A TAXA do motoboy não é tocada aqui de propósito: é dinheiro da operação e o
 * vendedor não mexe nisso.
 */
export async function editarCorridaDaFilaAction(formData: FormData): Promise<ResultadoDaFila> {
    try {
        const porta = await autorizarFila(formData.get("queueToken"));
        if (!porta.ok) return { error: porta.erro };
        const { sessao } = porta;

        const corrida = await corridaDaLoja(sessao, formData.get("id"));
        if (!corrida) return { error: "Corrida não encontrada." };
        if (!podeEditarNaFila(corrida)) {
            return { error: "O motoboy já saiu com esse pedido — não dá mais pra corrigir." };
        }

        const address = (formData.get("address") as string)?.trim();
        if (!address) return { error: "Endereço obrigatório." };

        const chargeMode: ChargeMode = normalizarChargeMode(formData.get("chargeMode"), null);
        const value = chargeMode === "pago" ? 0 : lerDinheiro(formData.get("value"));
        if (value === null) return { error: "Valor a receber inválido. Escreva assim: 12,50" };

        const { lat, lng, geoPrecision } = await resolverPontoEditado({
            shopkeeperId: corrida.shopkeeperId,
            address,
            enderecoAnterior: corrida.address,
            geoPrecisionAnterior: corrida.geoPrecision ?? null,
            pinTouched: formData.get("pinTouched") === "1",
            lat: Number(formData.get("lat")),
            lng: Number(formData.get("lng")),
            origem: "FILA",
        });

        const customerName = (formData.get("customerName") as string)?.trim() || null;
        const customerPhone = (formData.get("customerPhone") as string)?.trim() || null;
        const observation = (formData.get("observation") as string)?.trim() || null;

        // O WHERE repete a janela: se o motoboy coletar entre a leitura e agora,
        // nada é gravado e a tela avisa.
        const salvo = await db.update(deliveries)
            .set({
                address, lat, lng, value, chargeMode,
                customerName, customerPhone, observation,
                geoPrecision,
                updatedAt: new Date().toISOString(),
            })
            .where(and(
                eq(deliveries.id, corrida.id),
                eq(deliveries.shopkeeperId, sessao.shopkeeperId),
                inArray(deliveries.status, ["pending", "assigned"]),
            ))
            .returning({ id: deliveries.id });

        if (!salvo.length) return { error: "Essa corrida mudou de situação. Atualize a tela." };

        // Motoboy já com a corrida no nome tem que saber que o endereço mudou —
        // senão ele sai com o que anotou antes.
        if (corrida.motoboyId) {
            pushToUser(corrida.motoboyId, {
                title: "✏️ Corrida corrigida pela loja",
                body: `A loja ajustou os dados da corrida #${corrida.id}. Confira antes de sair.`,
                url: "/app",
                tag: `entrega-${corrida.id}`,
            }).catch(() => { });
        }

        await logServerEvent("fila_editada", `Corrida ${corrida.id} corrigida pela fila da loja`, {
            page: PAGINA,
            userId: sessao.shopkeeperId,
            deliveryId: corrida.id,
            operatorName: sessao.operatorName,
        });

        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[FILA] editar falhou:", e);
        await logServerError("fila_editar", e, { page: PAGINA });
        return { error: "Não consegui salvar a correção agora. Tente de novo." };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancelar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cancela a corrida. Status gravado é "canceled" — com UM L, como está no enum
 * do banco (src/db/schema.ts). Escrever "cancelled" aqui deixaria a corrida num
 * limbo que nenhuma tela lista.
 *
 * Se ela já estava no nome de um motoboy, ele é avisado na hora: pode estar
 * vindo buscar o pedido nesse momento.
 */
export async function cancelarCorridaDaFilaAction(formData: FormData): Promise<ResultadoDaFila> {
    try {
        const porta = await autorizarFila(formData.get("queueToken"));
        if (!porta.ok) return { error: porta.erro };
        const { sessao } = porta;

        const corrida = await corridaDaLoja(sessao, formData.get("id"));
        if (!corrida) return { error: "Corrida não encontrada." };
        if (!podeCancelarNaFila(corrida)) {
            return { error: "O motoboy já saiu com esse pedido — fale com ele antes de cancelar." };
        }

        // Quem cancelou fica registrado na nota do recibo, no estilo do
        // "finalizada pela loja (Fulano)" que a finalização já usa.
        const receiptNote = carimboDaFila(corrida.receiptNote, "cancelada", sessao.operatorName, 500);

        const cancelada = await db.update(deliveries)
            .set({
                status: "canceled",
                receiptNote,
                // Código de conferência de rascunho cancelado não serve mais.
                confirmToken: null,
                confirmTokenExpiresAt: null,
                updatedAt: new Date().toISOString(),
            })
            .where(and(
                eq(deliveries.id, corrida.id),
                eq(deliveries.shopkeeperId, sessao.shopkeeperId),
                inArray(deliveries.status, ["draft", "pending", "assigned"]),
            ))
            .returning({ id: deliveries.id });

        if (!cancelada.length) return { error: "Essa corrida mudou de situação. Atualize a tela." };

        if (corrida.motoboyId) {
            pushToUser(corrida.motoboyId, {
                title: "❌ Corrida cancelada pela loja",
                body: `A corrida #${corrida.id} foi cancelada. Não precisa buscar.`,
                url: "/app",
                tag: `entrega-${corrida.id}`,
            }).catch(() => { });
        }

        await logServerEvent("fila_cancelada", `Corrida ${corrida.id} cancelada pela fila da loja`, {
            page: PAGINA,
            userId: sessao.shopkeeperId,
            deliveryId: corrida.id,
            operatorName: sessao.operatorName,
        });

        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[FILA] cancelar falhou:", e);
        await logServerError("fila_cancelar", e, { page: PAGINA });
        return { error: "Não consegui cancelar agora. Tente de novo." };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lançar corrida na mão
// ─────────────────────────────────────────────────────────────────────────────

/**
 * O vendedor lança uma corrida que não veio do PDV (cliente ligou, passou na
 * loja…).
 *
 * Ela nasce `pending`, já liberada pros motoboys — não passa por rascunho. O
 * motivo é simples: quem digita É a pessoa que conferiria depois. Mandar ela
 * conferir o que acabou de escrever seria um clique sem sentido.
 *
 * Sem escolher motoboy e sem data de outro dia de propósito: destinar corrida é
 * decisão de operação (a loja faz pelo app) e lançamento atrasado mexe no
 * fechamento do dia, que é dinheiro.
 */
export async function lancarCorridaDaFilaAction(formData: FormData): Promise<ResultadoDaFila> {
    try {
        const porta = await autorizarFila(formData.get("queueToken"));
        if (!porta.ok) return { error: porta.erro };
        const { sessao } = porta;

        const address = (formData.get("address") as string)?.trim();
        if (!address) return { error: "Endereço obrigatório." };

        const chargeMode: ChargeMode = normalizarChargeMode(formData.get("chargeMode"), null);
        const valorLido = chargeMode === "pago" ? 0 : lerDinheiro(formData.get("value"));
        if (valorLido === null) return { error: "Valor a receber inválido. Escreva assim: 12,50" };

        const customerName = (formData.get("customerName") as string)?.trim() || null;
        const customerPhone = (formData.get("customerPhone") as string)?.trim() || null;
        const observacaoDigitada = (formData.get("observation") as string)?.trim() || null;

        const criada = await criarCorridaDaLoja({
            shopkeeperId: sessao.shopkeeperId,
            address,
            customerName,
            customerPhone,
            // Carimbo de quem digitou, no estilo do "destinada pela loja a X".
            observation: carimboDaFila(observacaoDigitada, "lançada", sessao.operatorName),
            chargeMode,
            value: valorLido,
            quandoISO: new Date().toISOString(),
            origem: PAGINA,
        });
        if (!criada.ok) return { error: criada.erro };

        // Fila aberta: só quem pode VER essa corrida é avisado (regra única em
        // src/lib/team.ts). Endereço com número é dado do cliente — no aviso vai
        // só o bairro.
        pushDeCorridaNova(sessao.shopkeeperId, {
            title: "🏍️ Nova Corrida Disponível!",
            body: avisoDeCorridaNovaComNumero(criada.dailySeq, address),
            url: "/app",
            tag: "nova-corrida",
        }).catch(() => { });

        await logServerEvent("fila_lancada", `Corrida ${criada.id} lançada pela fila da loja`, {
            page: PAGINA,
            userId: sessao.shopkeeperId,
            deliveryId: criada.id,
            dailySeq: criada.dailySeq,
            operatorName: sessao.operatorName,
        });

        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("[FILA] lançar falhou:", e);
        await logServerError("fila_lancar", e, { page: PAGINA });
        return { error: "Não consegui lançar a corrida agora. Tente de novo." };
    }
}
