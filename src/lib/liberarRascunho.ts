import "server-only";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { geocodeAddress, type GeocodeOpts } from "@/lib/routeUtils";
import { pushDeCorridaNova, pushDeCorridaDestinada } from "@/lib/push";
import { parseMoney } from "@/lib/money";
import { logServerError } from "@/lib/serverLog";
import { avisoDeCorridaNovaComNumero, resumoDoLocal } from "@/lib/deliveryPrivacy";
import { proximoNumeroDoDia } from "@/lib/dailySeq";
import { normalizarChargeMode, type ChargeMode } from "@/lib/chargeMode";

/**
 * Libera um rascunho do PDV pros motoboys (draft → pending, ou → assigned
 * quando a loja já escolheu quem leva).
 *
 * Saiu de src/app/actions/drafts.ts porque agora DUAS portas liberam rascunho:
 * a conferência de sempre (logado no Zap ou com o código do PDV) e a Fila da
 * loja, que também pode destinar a corrida a um motoboy. Num arquivo
 * "use server" toda função exportada vira ação chamável pelo navegador — um
 * parâmetro "destinatário já conferido" ali seria uma porta aberta. Aqui, fora
 * dele, só o código do servidor chama, e QUEM chama é que confere o motoboy
 * (src/lib/trocaDeMotoboy.ts → conferirMotoboyDaCorrida).
 */

export type ResultadoDaLiberacao = { error: string } | { success: true };

export type OpcoesDaLiberacao = {
    /** Motoboy já conferido por quem chamou. `null` = fila aberta. */
    destinatario: { id: number; name: string } | null;
    /** Como quem destinou aparece na observação ("pela loja", "pela loja (Maria)"). */
    autoria?: string;
};

/** Dinheiro digitado na tela. Vazio é zero; texto ilegível é `null` (vira erro). */
function lerDinheiro(raw: FormDataEntryValue | null): number | null {
    const texto = String(raw ?? "").trim();
    if (!texto) return 0;
    const n = parseMoney(texto);
    return n === null || n < 0 ? null : n;
}

export async function liberarRascunho(
    draft: typeof deliveries.$inferSelect,
    formData: FormData,
    { destinatario, autoria = "pela loja" }: OpcoesDaLiberacao,
): Promise<ResultadoDaLiberacao> {
    const address = (formData.get("address") as string)?.trim();
    if (!address) return { error: "Endereço obrigatório." };

    // Tipo de cobrança: "Receber na entrega", "Conferir Pix da loja" ou "Já pago".
    // "Já pago" zera o valor — é assim que o motoboy sabe que não tem o que cobrar.
    // Formulário antigo (sem o campo) cai na régua velha do checkbox "collect".
    const chargeMode: ChargeMode = formData.has("chargeMode")
        ? normalizarChargeMode(formData.get("chargeMode"), null)
        : (formData.get("collect") === "on" ? "receber" : "pago");
    // Em "Já pago" o campo de valor está escondido na tela: nem lê, pra um
    // rascunho de texto esquecido lá dentro não derrubar a liberação.
    const valorLido = chargeMode === "pago" ? 0 : lerDinheiro(formData.get("value"));
    if (valorLido === null) return { error: "Valor a receber inválido. Escreva assim: 12,50" };
    const value = valorLido;
    const fee = lerDinheiro(formData.get("fee"));
    if (fee === null) return { error: "Taxa da corrida inválida. Escreva assim: 12,50" };

    // O pino do mapa manda coordenadas; se vierem vazias, tenta geocodificar o endereço editado.
    // `pinTouched` diz se ALGUÉM de fato mexeu no pino. Sem isso o formulário
    // mandava as coordenadas da loja (o ponto de partida quando o geocode falha)
    // e a corrida era gravada como "exata" — o motoboy chegava na casa do cliente
    // e o botão "Entregue" ficava bloqueado, porque a cerca media a distância até a LOJA.
    const pinTouched = formData.get("pinTouched") === "1";
    let lat = Number(formData.get("lat"));
    let lng = Number(formData.get("lng"));
    const pinValid = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    const semPinoDeOrigem = !draft.lat || draft.lat === 0;

    // Endereço que nunca foi localizado no mapa só pode ser liberado com o pino
    // colocado na mão — senão a corrida sai com as coordenadas da loja.
    if (semPinoDeOrigem && !pinTouched) {
        return {
            error: "Esse endereço não foi encontrado no mapa. Arraste o pino até o lugar da entrega antes de liberar.",
        };
    }

    const enderecoMudou = address !== draft.address;
    // Só é "exata" quando uma pessoa colocou o pino no lugar. Sem isso vale a
    // precisão que o geocode achou (ou nada) — e a tela do lojista continua
    // avisando que o ponto é chute.
    let geoPrecision: string | null = draft.geoPrecision ?? null;

    if (pinTouched && pinValid) {
        geoPrecision = "exata";
    } else {
        // Ninguém mexeu no pino: o ponto que vale é o do geocode. Se o endereço
        // foi editado, o ponto antigo não serve mais — procura de novo.
        lat = draft.lat ?? 0;
        lng = draft.lng ?? 0;
        if (enderecoMudou || lat === 0 || lng === 0) {
            lat = 0; lng = 0;
            geoPrecision = null;
            try {
                const s = await db.query.shopSettings.findFirst({
                    where: eq(shopSettings.userId, draft.shopkeeperId ?? -1),
                    columns: { defaultCity: true, defaultState: true, shopLat: true, shopLng: true },
                });
                const opts: GeocodeOpts = {
                    defaultCity: s?.defaultCity ?? null,
                    defaultState: s?.defaultState ?? null,
                    shopLat: s?.shopLat ?? null,
                    shopLng: s?.shopLng ?? null,
                };
                const coords = await geocodeAddress(address, opts);
                if (coords) { lat = coords.lat; lng = coords.lng; geoPrecision = coords.precision; }
            } catch (e) {
                console.error("[DRAFT] geocode na confirmação falhou:", e);
                await logServerError("draft_geocode_falhou", e, { deliveryId: draft.id, page: "/confirmar" });
            }
        }
    }

    const customerName = (formData.get("customerName") as string)?.trim() || null;
    const customerPhone = (formData.get("customerPhone") as string)?.trim() || null;
    const observationDigitada = (formData.get("observation") as string)?.trim() || null;
    const observation = destinatario
        ? [observationDigitada, `destinada ${autoria} a ${destinatario.name}`]
            .filter(Boolean).join(" · ").slice(0, 1000)
        : observationDigitada;

    const agora = new Date().toISOString();

    // Condição de corrida: só libera se ainda estiver como rascunho (dois cliques não
    // podem notificar os motoboys duas vezes).
    //
    // É AQUI que o rascunho ganha o "Corrida N" do dia: enquanto era rascunho
    // ele não era corrida nenhuma, e ficar com número reservado deixaria buraco
    // na contagem se o lojista cancelasse. O número sai e o status muda na MESMA
    // transação — dois cliques simultâneos não geram dois "Corrida 7".
    const updated = db.transaction((tx) => {
        const dailySeq = draft.dailySeq ?? proximoNumeroDoDia(
            tx,
            draft.shopkeeperId,
            // O dia é o da CRIAÇÃO da corrida, não o do clique. Rascunho feito
            // 23h50 e liberado 00h05 é raro, mas se fosse numerado no dia da
            // liberação ele não entraria na conta de nenhum dos dois dias (a
            // conta é feita por `created_at`) e o próximo pedido repetiria o
            // número. Na prática o caixa confere em segundos e os dois dias são
            // o mesmo.
            draft.createdAt ?? agora,
        );
        return tx.update(deliveries)
            .set({
                dailySeq,
                // Código usado: não serve de novo.
                confirmToken: null,
                confirmTokenExpiresAt: null,
                address, lat, lng, value, fee, customerName, customerPhone, observation,
                chargeMode,
                geoPrecision,
                // Destinada a alguém já nasce "aceita": ele não precisa disputar no
                // pool uma corrida que a loja deu pra ele.
                motoboyId: destinatario?.id ?? null,
                status: destinatario ? "assigned" : "pending",
                acceptedAt: destinatario ? agora : null,
                updatedAt: agora,
            })
            .where(and(eq(deliveries.id, draft.id), eq(deliveries.status, "draft")))
            .returning({ id: deliveries.id, dailySeq: deliveries.dailySeq })
            .all();
    });

    if (!updated.length) return { error: "Essa corrida já foi liberada." };
    const numeroDoDia = updated[0].dailySeq;

    // Endereço com número é dado pessoal do cliente saindo do app pra um
    // aparelho que a loja não controla — nos dois casos vai só o bairro.
    if (destinatario) {
        // Corrida com dono não vira anúncio: só o escolhido é avisado.
        pushDeCorridaDestinada(destinatario.id, draft.id, resumoDoLocal(address), null, numeroDoDia)
            .catch(() => { });
    } else {
        // Só quem pode VER essa corrida é avisado (regra única em team.ts).
        pushDeCorridaNova(draft.shopkeeperId, {
            title: "🏍️ Nova Corrida Disponível!",
            body: avisoDeCorridaNovaComNumero(numeroDoDia, address),
            url: "/app",
            tag: "nova-corrida",
        }).catch(() => { });
    }

    return { success: true };
}
