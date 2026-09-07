import { db } from "@/db";
import { deliveries, users, shopSettings } from "@/db/schema";
import { eq, and, ne, inArray, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse, after } from "next/server";
import { geocodeAddress } from "@/lib/routeUtils";
import type { ParsedAddress } from "@/lib/addressParser";
import { newTrackingToken, newConfirmToken, confirmTokenExpiry } from "@/lib/trackingToken";
import { pushToDraftReviewers } from "@/lib/push";
import { parseMoney } from "@/lib/money";
import { calcularTaxa, dependeDaDistancia } from "@/lib/fee";
import { logServerError } from "@/lib/serverLog";
import { aplicarLimite } from "@/lib/rateLimit";

/**
 * API de Integração para PDV
 *
 * Headers: X-API-KEY: zap_<userId>_<random>
 */

/** Campo de texto do corpo da requisição, aparado e limitado. */
function str(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null;
}

/** Quanto tempo duas chamadas parecidas, sem número de pedido, são a mesma corrida. */
const JANELA_DUPLICATA_MIN = 10;

/**
 * Número do pedido no PDV. É o que impede que um reenvio (o caixa clica duas
 * vezes, ou o EpicStore repete por timeout) vire duas corridas e duas taxas.
 *
 * TRANSIÇÃO: o EpicStore ainda não manda `externalId` em todas as versões em uso.
 * Enquanto isso, deduzimos do começo da observação, que hoje sai sempre como
 * "Pedido #1234 - 2x Produto..." (ver sendToZapEntregas em EpicStore
 * src/app/actions/delivery.js). O número deduzido é o MESMO id do pedido que a
 * versão nova manda em `externalId`, então as duas versões conversam sem sustos.
 * Quando todos os PDVs estiverem atualizados, esta dedução pode sair.
 */
function extrairExternalId(body: any): string | null {
    if (typeof body.externalId === "string" && body.externalId.trim()) {
        return body.externalId.trim().slice(0, 64);
    }
    if (typeof body.externalId === "number" && Number.isFinite(body.externalId)) {
        return String(body.externalId);
    }
    const obs = typeof body.observation === "string" ? body.observation : "";
    const m = obs.match(/^\s*Pedido\s*#\s*(\d{1,40})\b/i);
    return m ? m[1] : null;
}

function appBaseUrl(): string {
    return process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://zapentregas.duckdns.org";
}

/** O banco reclamou que já existe uma corrida com esse número de pedido? */
function ehViolacaoDeUnico(e: unknown): boolean {
    const msg = String((e as any)?.message ?? e ?? "");
    const code = String((e as any)?.code ?? "");
    return code.includes("SQLITE_CONSTRAINT") || /UNIQUE constraint failed/i.test(msg);
}

type CorridaExistente = {
    id: number;
    status: string;
    publicToken: string | null;
    confirmToken: string | null;
};

/**
 * Acha a corrida que este mesmo pedido já criou, se houver.
 *
 * 1º: pelo número do pedido (`external_id`) — é a garantia de verdade.
 * 2º: sem número de pedido, uma rede de segurança: mesma loja, mesmo telefone
 *     (ou mesmo endereço, quando não veio telefone), ainda por liberar/aceitar,
 *     criada nos últimos 10 minutos.
 *
 * Corrida cancelada não conta: se o pedido foi refeito depois de cancelar, é
 * pra criar de novo mesmo.
 */
async function acharDuplicata(
    shopkeeperId: number,
    externalId: string | null,
    customerPhone: string | null,
    address: string
): Promise<CorridaExistente | null> {
    const colunas = { id: true, status: true, publicToken: true, confirmToken: true } as const;

    if (externalId) {
        const achada = await db.query.deliveries.findFirst({
            where: and(
                eq(deliveries.shopkeeperId, shopkeeperId),
                eq(deliveries.externalId, externalId),
                ne(deliveries.status, "canceled")
            ),
            columns: colunas,
            orderBy: desc(deliveries.id),
        });
        return achada ?? null;
    }

    const telefone = customerPhone && customerPhone.trim() ? customerPhone.trim() : null;
    const achada = await db.query.deliveries.findFirst({
        where: and(
            eq(deliveries.shopkeeperId, shopkeeperId),
            inArray(deliveries.status, ["draft", "pending"]),
            telefone ? eq(deliveries.customerPhone, telefone) : eq(deliveries.address, address),
            // datetime() no SQL porque o created_at do banco veio em dois formatos
            // ("2026-09-07 13:00:00" das linhas antigas, ISO com T e Z das novas).
            // Comparar como texto daria errado entre os dois.
            sql`datetime(${deliveries.createdAt}) >= datetime('now', ${`-${JANELA_DUPLICATA_MIN} minutes`})`
        ),
        columns: colunas,
        orderBy: desc(deliveries.id),
    });
    return achada ?? null;
}

/**
 * Resposta de "esse pedido já virou corrida". 200 e `success: true` de propósito:
 * pro PDV deu certo — a corrida existe, é só não criar outra.
 * Se ela ainda está esperando conferência, renova o link do caixa (que vale uma
 * vez só e por 2h), senão o operador reenvia e fica sem por onde conferir.
 */
async function respostaDuplicata(existente: CorridaExistente, feeIgnored: boolean) {
    const baseUrl = appBaseUrl();
    let confirmToken = existente.confirmToken;

    if (existente.status === "draft") {
        confirmToken = newConfirmToken();
        await db.update(deliveries)
            .set({
                confirmToken,
                confirmTokenExpiresAt: confirmTokenExpiry(),
                updatedAt: new Date().toISOString(),
            })
            .where(eq(deliveries.id, existente.id));
    }

    return {
        success: true,
        duplicate: true,
        deliveryId: existente.id,
        ...(feeIgnored ? { feeIgnored: true } : {}),
        ...(existente.publicToken ? { trackingUrl: `${baseUrl}/tracking/${existente.publicToken}` } : {}),
        ...(existente.status === "draft" && confirmToken
            ? { confirmUrl: `${baseUrl}/confirmar/${confirmToken}` }
            : {}),
        status: existente.status,
        message: "Esse pedido já tinha corrida no Zap Entregas — não criamos outra.",
    };
}

/**
 * Procura o endereço no mapa DEPOIS de responder ao PDV e guarda o pino.
 * Usa o `after()` do Next quando ele existe; se não, solta a promessa mesmo
 * (com catch), que é o comportamento antigo de "não trava a resposta".
 */
function agendarGeocode(
    deliveryId: number,
    shopkeeperId: number,
    address: string,
    partes: Partial<ParsedAddress> | null
) {
    const trabalho = async () => {
        try {
            const s = await db.query.shopSettings.findFirst({
                where: eq(shopSettings.userId, shopkeeperId),
                columns: { defaultCity: true, defaultState: true, shopLat: true, shopLng: true },
            });
            const coords = await geocodeAddress(address, {
                defaultCity: s?.defaultCity ?? null,
                defaultState: s?.defaultState ?? null,
                shopLat: s?.shopLat ?? null,
                shopLng: s?.shopLng ?? null,
            }, partes);
            if (!coords) return;
            await db.update(deliveries)
                .set({ lat: coords.lat, lng: coords.lng, geoPrecision: coords.precision })
                .where(eq(deliveries.id, deliveryId));
        } catch (e) {
            // Sem pino a corrida continua válida: a tela de conferência avisa
            // "não achei esse endereço" e o caixa arrasta o pino na mão.
            console.error("[INTEGRATION] geocode falhou:", e);
            await logServerError("geocode_pdv", e, { userId: shopkeeperId, page: "/api/integration/delivery", deliveryId, address });
        }
    };

    if (typeof after === "function") {
        // Passa a FUNÇÃO, não a promessa: assim ela só roda depois da resposta sair.
        after(trabalho);
        return;
    }
    void trabalho();
}

async function authenticateApiKey(apiKey: string | null) {
    if (!apiKey || !apiKey.startsWith("zap_")) return null;
    return db.query.users.findFirst({
        where: and(eq(users.apiKey, apiKey), eq(users.role, "shopkeeper")),
    });
}

export async function POST(request: NextRequest) {
    try {
        const apiKey = request.headers.get("X-API-KEY");
        const user = await authenticateApiKey(apiKey);

        if (!user) {
            return NextResponse.json(
                { success: false, error: "API Key inválida ou lojista não encontrado" },
                { status: 401 }
            );
        }

        // Teto por chave: cada corrida nova dispara uma busca de endereço PAGA no
        // Google. Um PDV em laço (bug ou má-fé) queimaria a cota da operação toda.
        // 120 por minuto é muito acima do movimento real de uma loja.
        const ritmo = aplicarLimite("webhookPdv", `key:${user.id}`);
        if (!ritmo.permitido) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Muitas chamadas seguidas. Tente de novo em ${ritmo.esperarSegundos} segundos.`,
                },
                { status: 429, headers: { "Retry-After": String(ritmo.esperarSegundos) } }
            );
        }

        // O PDV é código de terceiro: corpo quebrado tem que voltar 400 explicando,
        // e não 500 "erro interno" (que manda o caixa ligar pro suporte à toa).
        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { success: false, error: "JSON inválido" },
                { status: 400 }
            );
        }
        if (!body || typeof body !== "object") {
            return NextResponse.json(
                { success: false, error: "JSON inválido" },
                { status: 400 }
            );
        }

        // Endereço só com espaço é o mesmo que endereço em branco.
        const address = typeof body.address === "string" ? body.address.trim().slice(0, 500) : "";
        if (!address) {
            return NextResponse.json(
                { success: false, error: "Endereço é obrigatório" },
                { status: 400 }
            );
        }

        // O PDV manda o valor como o Brasil escreve ("12,50"). Number("12,50") é
        // NaN e a corrida entrava valendo zero sem ninguém perceber.
        let value = 0;
        if (body.value !== undefined && body.value !== null && body.value !== "") {
            const parsed = parseMoney(body.value);
            if (parsed === null) {
                return NextResponse.json(
                    { success: false, error: "Valor inválido. Use 12.50 ou \"12,50\"." },
                    { status: 400 }
                );
            }
            if (parsed < 0) {
                return NextResponse.json(
                    { success: false, error: "Valor não pode ser negativo" },
                    { status: 400 }
                );
            }
            value = parsed;
        }

        // O PDV às vezes manda "fee" achando que define o ganho do motoboy. Não
        // define (ver abaixo) — então avisamos na resposta em vez de ignorar calado.
        const feeIgnored = body.fee !== undefined && body.fee !== null && body.fee !== "";

        const customerName = typeof body.customerName === "string" ? body.customerName.slice(0, 200) : null;
        const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.slice(0, 30) : null;
        const observation = typeof body.observation === "string" ? body.observation.slice(0, 1000) : null;
        const externalId = extrairExternalId(body);

        // ── Idempotência ────────────────────────────────────────────────────
        // Antes daqui era só INSERT: reenviar o mesmo pedido criava uma segunda
        // corrida, dois motoboys aceitavam e a loja pagava duas taxas.
        const jaExiste = await acharDuplicata(user.id, externalId, customerPhone, address);
        if (jaExiste) {
            return NextResponse.json(
                await respostaDuplicata(jaExiste, feeIgnored)
            );
        }

        // ── Limite do plano ─────────────────────────────────────────────────
        // O caminho que mais gera corrida — o PDV — não passava por nenhuma
        // verificação: o limite comercial não segurava nada na prática.
        // 403 com mensagem pronta pro caixa ler na tela do PDV.
        const { canCreateDelivery } = await import("@/lib/planLimits");
        const limite = await canCreateDelivery(user.id);
        if (!limite.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: limite.reason || "Limite de entregas do plano atingido.",
                    limitReached: true,
                    message: "O plano do Zap Entregas chegou ao limite de corridas do mês. A entrega NÃO foi registrada — avise a loja.",
                },
                { status: 403 }
            );
        }

        // "fee" aqui é o que o MOTOBOY ganha (contrato da tela de conferência), não o
        // frete que o PDV cobra do cliente — por isso body.fee é ignorado. Nasce da
        // regra da loja e o lojista pode ajustar na conferência.
        //
        // A corrida do PDV ainda NÃO tem pino no mapa (o geocode roda depois de
        // responder), então aqui não dá pra medir a distância. Loja que paga por
        // km (ou fixo + km) nasce com taxa 0 DE PROPÓSITO: quem calcula é o
        // completeDeliveryAction, na entrega, quando o pino já existe. Loja de
        // taxa fixa já sai com o valor certo. O lojista pode ajustar na conferência.
        let fee = 0;
        try {
            const remu = await db.query.shopSettings.findFirst({
                where: eq(shopSettings.userId, user.id),
                columns: {
                    remunerationModel: true, fixedValue: true,
                    valuePerKm: true, guaranteedMinimum: true,
                },
            });
            if (remu && !dependeDaDistancia(remu.remunerationModel)) {
                fee = calcularTaxa(remu, null);
            }
        } catch { /* sem regra, taxa fica 0 e o lojista preenche na conferência */ }

        // O endereço no mapa fica pra depois da resposta (ver `after` lá embaixo):
        // achar o ponto pode levar segundos e o caixa não pode ficar esperando.
        let newDelivery;
        try {
            newDelivery = await db.insert(deliveries).values({
                shopkeeperId: user.id,
                customerName,
                customerPhone,
                address,
                lat: null,
                lng: null,
                value,
                fee,
                observation,
                geoPrecision: null,
                externalId,
                // Nasce rascunho: o lojista/admin confere endereço no mapa e libera pros motoboys.
                status: "draft",
                publicToken: newTrackingToken(),
                confirmToken: newConfirmToken(),
                confirmTokenExpiresAt: confirmTokenExpiry(),
                // ISO explícito: o CURRENT_TIMESTAMP do banco grava noutro formato.
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }).returning().get();
        } catch (e: any) {
            // Duas chamadas do mesmo pedido ao mesmo tempo: o índice único barra a
            // segunda. Isso é duplicata, não erro — devolve a corrida que venceu.
            if (externalId && ehViolacaoDeUnico(e)) {
                const vencedora = await acharDuplicata(user.id, externalId, null, address);
                if (vencedora) {
                    return NextResponse.json(await respostaDuplicata(vencedora, feeIgnored));
                }
            }
            throw e;
        }

        // Quem é avisado agora é quem libera, não o motoboy.
        pushToDraftReviewers(user.id, {
            title: "📦 Corrida do PDV esperando confirmação",
            body: address,
            url: `/deliveries/${newDelivery.id}/confirmar`,
            tag: `confirmar-${newDelivery.id}`,
        }).catch(() => { });

        // Procurar o endereço no mapa depois de responder ao PDV. A tela de
        // conferência já sabe abrir sem pino ("não achei esse endereço") e o
        // pino chega sozinho quando esta parte termina.
        const partes = typeof body.addressParts === "object" && body.addressParts
            ? {
                street: str(body.addressParts.street),
                number: str(body.addressParts.number),
                neighborhood: str(body.addressParts.neighborhood),
                city: str(body.addressParts.city),
                state: str(body.addressParts.state),
                cep: str(body.addressParts.cep),
            }
            : null;
        agendarGeocode(newDelivery.id, user.id, address, partes);

        const baseUrl = appBaseUrl();

        return NextResponse.json({
            success: true,
            deliveryId: newDelivery.id,
            // Avisa o PDV que o "fee" que ele mandou não foi usado.
            ...(feeIgnored ? { feeIgnored: true } : {}),
            trackingUrl: `${baseUrl}/tracking/${newDelivery.publicToken}`,
            // O PDV abre isto numa janela por cima da venda pra conferir o endereço na hora.
            confirmUrl: `${baseUrl}/confirmar/${newDelivery.confirmToken}`,
            status: newDelivery.status,
            message: "Entrega registrada! Aguardando confirmação do endereço para liberar aos motoboys.",
        });
    } catch (error: any) {
        console.error("Erro na API de integração:", error);
        await logServerError("webhook_pdv", error, { page: "/api/integration/delivery" });
        return NextResponse.json(
            { success: false, error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    const apiKey = request.headers.get("X-API-KEY");
    const user = await authenticateApiKey(apiKey);

    if (!user) {
        return NextResponse.json({ success: false, error: "API Key inválida" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deliveryId = Number(searchParams.get("id"));
    if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
        return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const delivery = await db.query.deliveries.findFirst({
        where: and(
            eq(deliveries.id, deliveryId),
            eq(deliveries.shopkeeperId, user.id)
        ),
        with: { motoboy: true },
    });

    if (!delivery) {
        return NextResponse.json({ success: false, error: "Entrega não encontrada" }, { status: 404 });
    }

    return NextResponse.json({
        success: true,
        delivery: {
            id: delivery.id,
            status: delivery.status,
            customerName: delivery.customerName,
            address: delivery.address,
            motoboy: delivery.motoboy ? {
                name: delivery.motoboy.name,
                phone: delivery.motoboy.phone,
            } : null,
            createdAt: delivery.createdAt,
            updatedAt: delivery.updatedAt,
        },
    });
}
